import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, Between, In, EntityManager } from 'typeorm';
import { Response } from 'express';
import { LeaveRequest } from './entities/leave-request.entity';
import { LeaveBalance } from './entities/leave-balance.entity';
import { LeaveConfig } from './entities/leave-config.entity';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { RejectLeaveDto } from './dto/reject-leave.dto';
import { LeaveRequestStatus } from 'src/common/enums/leave-request-status.enum';
import { LeaveType } from 'src/common/enums/leave-type.enum';
import { User } from '../users/entities/user.entity';
import { UserRole } from 'src/common/enums/user-role.enum';
import { HalfDayType } from 'src/common/enums/halfDayType.enum';
import { EmploymentType } from 'src/common/enums/user-employeeType.enum';
import { InsuranceSubType, PersonalPaidSubType } from 'src/common/enums/leave-subType.enum';
import { LeaveAccrualService } from './leave-accrual.service';
import { MailService } from '../mail/mail.service';
import { DataSource, QueryRunner } from 'typeorm';
import { LeaveAttachment } from './entities/leave_attachments';
import { unlink } from 'fs/promises';
import { LeaveRequestQueryBuilder } from './leave-request.query-builder';
import { LeaveListQueryDto } from './dto/leave-list-query.dto';
import { CaslAbilityFactory } from '../casl/casl-ability.factory';
import { ForbiddenError } from '@casl/ability';
import { Action } from 'src/common/enums/action.enum';
import { join } from 'path';

@Injectable()
export class LeaveService {
  constructor(
    @InjectRepository(LeaveRequest)
    private leaveRequestRepo: Repository<LeaveRequest>,

    @InjectRepository(LeaveBalance)
    private leaveBalanceRepo: Repository<LeaveBalance>,

    @InjectRepository(User)
    private userRepo: Repository<User>,

    @InjectRepository(LeaveConfig)
    private leaveConfigRepo: Repository<LeaveConfig>,

    @InjectRepository(LeaveAttachment)
    private leaveAttachmentRepo: Repository<LeaveAttachment>,

    private readonly caslAbilityFactory: CaslAbilityFactory,
    private readonly queryBuilder: LeaveRequestQueryBuilder,
    private leaveAccrualService: LeaveAccrualService,
    private mailService: MailService,
    private dataSource: DataSource,
  ) {}

  async getLeaveList(user: User, query: LeaveListQueryDto) {
    const { page = 1, limit = 10 } = query;

    let qb = this.queryBuilder.buildBaseQuery();

    qb = this.queryBuilder.applyAuthorization(qb, user);
    qb = this.queryBuilder.applyFilters(qb, query);

    // query đếm tổng trước
    const total = await qb.getCount();

    //query lấy dữ liệu
    const dataQb = qb.clone()

    dataQb.select([
      'lr.id AS id',
      'lr.leaveType AS leaveType',
      'lr.status AS status',
      'lr.startDate AS startDate',
      'lr.endDate AS endDate',
      'lr.createdAt AS createdAt',
      'user.name AS employeeName',
      'user.departmentName AS department',
    ])
    .orderBy('lr.createdAt', 'DESC')
    .offset((page - 1) * limit)
    .limit(limit);

    const rawData = await dataQb.getRawMany();

    const data = rawData.map((item) => ({
      id: item.id,
      leaveType: item.leaveType,
      status: item.status,
      startDate: item.startDate,
      endDate: item.endDate,
      createdAt: item.createdAt,
      employeeName: item.employeeName,
      department: item.department,
    }));

    return {
      data,
      total,
      page,
      lastPage: Math.ceil(total / limit),
    };
  }

  //Tạo đơn xin nghỉ
  async createLeaveRequest(userId: number, dto: CreateLeaveRequestDto, files: Express.Multer.File[]) {
    //tạo transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      // nghỉ bảo hiểm bắt buộc có file đính kèm
      if (dto.leaveType === LeaveType.INSURANCE) {
        if (!files || files.length === 0) {
          throw new BadRequestException(
            'Nghỉ bảo hiểm bắt buộc phải đính kèm hồ sơ',
          );
        }
      }
      const user = await queryRunner.manager.findOneBy(User, { id: userId });
      if (!user) throw new NotFoundException('Không tìm thấy nhân viên');

      if (
        (dto.leaveType === LeaveType.PAID || dto.leaveType === LeaveType.INSURANCE) &&
        user.employmentType !== EmploymentType.OFFICIAL
      ) {
        throw new ForbiddenException(
          `Bạn chưa lên chính thức nên chưa được sử dụng phép năm hoặc nghỉ bảo hiểm
          . Phép năm của bạn đang được tích lũy và sẽ được dùng khi lên chính thức.`,
        );
      }

      const startDate = new Date(dto.startDate);
      const endDate = new Date(dto.endDate);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (startDate > endDate) {
        throw new BadRequestException('Ngày bắt đầu phải trước hoặc bằng ngày kết thúc');
      }

      if (startDate.getTime() === endDate.getTime()) {
        if (dto.startHalfDayType === HalfDayType.AFTERNOON && dto.endHalfDayType === HalfDayType.MORNING) {
          throw new BadRequestException('Buổi bắt đầu không thể sau buổi kết thúc trong cùng một ngày');
        }
      }

      if (startDate < today) {
        // Cho phép ngày trong quá khứ nếu cùng tháng hiện tại
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();

        const startMonth = startDate.getMonth();
        const startYear = startDate.getFullYear();

        if (startMonth !== currentMonth || startYear !== currentYear) {
          throw new BadRequestException(
            'Chỉ được phép điền ngày nghỉ trong quá khứ trong tháng hiện tại',
          );
        }
      }

      // Lấy tất cả đơn của nhân viên để kiểm tra trùng
      const existingRequests = await this.leaveRequestRepo.find({
        where: {
          userId,
          status: In([LeaveRequestStatus.APPROVED, LeaveRequestStatus.PENDING]),
        },
      });
      
      for (const req of existingRequests) {
        const reqStart = new Date(req.startDate);
        const reqEnd = new Date(req.endDate);

        reqStart.setHours(0,0,0,0);
        reqEnd.setHours(0,0,0,0);

        const newStart = new Date(startDate);
        const newEnd = new Date(endDate);

        newStart.setHours(0,0,0,0);
        newEnd.setHours(0,0,0,0);

        // Giao nhau về ngày
        if (newStart <= reqEnd && newEnd >= reqStart) {
          //lấy các buổi nghỉ trong một ngày cụ thể
          const getSlots = (date: Date, dStart: Date, dEnd: Date, sHalf: HalfDayType, eHalf: HalfDayType) => {
            const isStartDay = date.getTime() === dStart.getTime();
            const isEndDay = date.getTime() === dEnd.getTime();
            
            if (isStartDay && isEndDay) {
              if (sHalf === HalfDayType.MORNING && eHalf === HalfDayType.MORNING) return [1];
              if (sHalf === HalfDayType.AFTERNOON && eHalf === HalfDayType.AFTERNOON) return [2];
              if (sHalf === HalfDayType.MORNING || eHalf === HalfDayType.AFTERNOON) return [1, 2];
              return [1, 2]; // MORNING -> AFTERNOON
            }
            if (isStartDay) {
              if (sHalf === HalfDayType.MORNING) return [1, 2];
              if (sHalf === HalfDayType.AFTERNOON) return [2];
            }
            if (isEndDay) {
              if (eHalf === HalfDayType.MORNING) return [1];
              if (eHalf === HalfDayType.AFTERNOON) return [1, 2];
            }
            return [1, 2]; // Ngày nằm giữa khoảng nghỉ
          };

          // Tìm các ngày giao nhau và kiểm tra xem có buổi nào bị trùng không
          const overlapStart = new Date(Math.max(newStart.getTime(), reqStart.getTime()));
          const overlapEnd = new Date(Math.min(newEnd.getTime(), reqEnd.getTime()));

          for (let d = new Date(overlapStart); d <= overlapEnd; d.setDate(d.getDate() + 1)) {
            const newSlots = getSlots(d, newStart, newEnd, dto.startHalfDayType, dto.endHalfDayType);
            const oldSlots = getSlots(d, reqStart, reqEnd, req.startHalfDayType, req.endHalfDayType);
            
            if (newSlots.some(s => oldSlots.includes(s))) {
              throw new BadRequestException(
                `Trùng lịch nghỉ với đơn đã được duyệt (${req.startDate} ${req.startHalfDayType} - ${req.endDate} ${req.endHalfDayType})`,
              );
            }
          }
        }
      }

      // Tính số ngày nghỉ
      const leaveDays = this.calculateLeaveDays(startDate, endDate, dto.startHalfDayType, dto.endHalfDayType);
      const currentYear = today.getFullYear();

      // Lấy hoặc tạo quỹ nghỉ
      let balance = await this.getOrCreateBalance(userId, currentYear);

      // Validate theo loại nghỉ
      let compensatoryInfo: { balance: number; warning?: string} | undefined;

      let paidDeduction = 0; // chỗ này là trừ đi phép năm nếu có
      let unpaidDeduction = 0; // chỗ này là trừ đi không lương nếu có

      if (dto.leaveType === LeaveType.PERSONAL_PAID || dto.leaveType === LeaveType.INSURANCE) {
        if (!dto.leaveSubType) {
          throw new BadRequestException('leaveSubType là bắt buộc');
        }
        const config = await this.getSubTypeLimit(dto.leaveType, dto.leaveSubType)
        if (!config) {
          throw new BadRequestException('Không tìm thấy loại nghỉ');
        }
        const limit = Number(config.limit);

        const usedDays = await this.getUsedDaysForSubType(
          userId, 
          dto.leaveSubType, 
          startDate.getFullYear(),
          config.isPerMonth ? startDate.getMonth() : undefined
        );
        const remaining = limit - usedDays;
        if (leaveDays > remaining) {
          throw new BadRequestException(
            `Bạn chỉ còn ${remaining} ngày cho loại nghỉ ${dto.leaveSubType}. 
            Không được vượt quá hạn mức.`
          );
        }
      } else if (dto.leaveType === LeaveType.PAID) {
        const annualRemaining = Number(balance.annualLeaveTotal) - Number(balance.annualLeaveUsed);
        if (annualRemaining < leaveDays) {
            throw new BadRequestException(
            `Bạn chỉ còn ${annualRemaining} ngày phép năm. 
            Không đủ cho ${leaveDays} ngày.
            Vui lòng tạo đơn nghỉ không lương`
          );
        } else {
          paidDeduction = leaveDays;
        }
      } else if (dto.leaveType === LeaveType.UNPAID) {
        unpaidDeduction = leaveDays;
      } else if (dto.leaveType === LeaveType.COMPENSATORY) {
        const compBalance = Number(balance.compensatoryBalance);
        compensatoryInfo = { balance: compBalance };
        const requiredHours = leaveDays * 8;
        if(requiredHours > compBalance){
          throw new BadRequestException(
            `Bạn chỉ còn ${compBalance} giờ nghỉ bù, không đủ cho ${requiredHours} giờ yêu cầu`,
          );
        }
      }

      // Tạo đơn nghỉ
      await this.validateLeaveSubType(dto.leaveType, dto.leaveSubType);
      const leaveRequest = queryRunner.manager.create(LeaveRequest, {
        userId,
        leaveType: dto.leaveType,
        leaveSubType: dto.leaveSubType || null,
        startDate,
        endDate,
        startHalfDayType: dto.startHalfDayType,
        endHalfDayType: dto.endHalfDayType,
        reason: dto.reason,
        paidLeaveDeduction: paidDeduction,
        unpaidLeaveDeduction: unpaidDeduction,
        status: LeaveRequestStatus.PENDING
      });
      const savedLeave = await queryRunner.manager.save(leaveRequest);

      console.log('savedLeave', savedLeave);
      console.log('files', files);

      // lưu file nếu có file
      if (files && files.length > 0) {
        const attachments = files.map((file) =>
          queryRunner.manager.create(LeaveAttachment, {
            leaveRequestId: savedLeave.id,
            originalName: file.originalname,
            fileName: file.filename,
            filePath: file.path,
            size: file.size,
            mimeType: file.mimetype,
          }),
        );
        await queryRunner.manager.save(attachments);
      }
      await queryRunner.commitTransaction();

      // commit xong mới gửi mail
      try {
        const lead = await this.userRepo.findOne({
        where : {
          departmentName: user.departmentName,
          role: UserRole.DEPARTMENT_LEAD
        }
      })
    
      if(lead){
        await this.mailService.sendLeaveRequestNotification(
          lead.email,
          user.name,
          user.departmentName,
          startDate,
          endDate,
        );
      }
      } catch (mailError) {
        console.error('Send mail failed:', mailError);
      }
      return {
        message: 'Tạo đơn xin nghỉ thành công',
        data: savedLeave,
        leaveDays,
        breakdown: {
          inQuota: (dto.leaveType === LeaveType.PERSONAL_PAID || dto.leaveType === LeaveType.INSURANCE) ? leaveDays : 0,
          paidDeduction,
          unpaidDeduction,
        },
      };
    } catch (error) {
      console.error('Create leave request failed:', error);
      // rollbakc db
      await queryRunner.rollbackTransaction();

      //xóa file nếu có
      if (files && files.length > 0) {
      await Promise.all(
        files.map((file) =>
          unlink(file.path).catch(() => {}),
        ),
      );
    }

    throw error;
    }
  }
  // lấy đơn xin nghỉ của mình
  async getListMyLeaveRequests(user: User, query: LeaveListQueryDto) {
    return this.getLeaveList(user, query);
  }

  /**
   * Xem số phép còn lại
   */
  async getMyBalance(userId: number) {
    const currentYear = new Date().getFullYear();
    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user) throw new NotFoundException('Không tìm thấy nhân viên');

    const balance = await this.getOrCreateBalance(userId, currentYear);
    const annualRemaining =
      Number(balance.annualLeaveTotal) - Number(balance.annualLeaveUsed);

    return {
      year: currentYear,
      annualLeaveTotal: Number(balance.annualLeaveTotal),
      annualLeaveUsed: Number(balance.annualLeaveUsed),
      annualLeaveRemaining: annualRemaining,
      unpaidLeaveUsed: Number(balance.unpaidLeaveUsed),
      compensatoryBalance: Number(balance.compensatoryBalance),
    };
  }

  // lấy danh sách đơn nghỉ của phòng ban của mình
  async getListRequests(user: User, query: LeaveListQueryDto) {
    return this.getLeaveList(user, query);
  }

  // duyệt đơn nghỉ
  async approveLeaveRequest(userId: number, requestId: number) {
    return await this.dataSource.transaction(async (manager) => {
      // lấy ra đơn nghỉ
      const leave = await this.leaveRequestRepo.findOne({
        where: { id: requestId },
        relations: ['user'],
      });
      
      if (!leave) throw new NotFoundException('Không tìm thấy đơn nghỉ');

      //lấy ra id người đang đăng nhập để kiểm tra quyền 
      const user = await this.userRepo.findOneBy({id: userId})
      
      if (!user) throw new NotFoundException('Không tìm thấy người duyệt');
      
      const ability = this.caslAbilityFactory.createForUser(user);
      // Cách 1
      //---------- dùng cách này thì sẽ chạy được 
      // if (!ability.can(Action.Approve, LeaveRequest)) {
      //   throw new ForbiddenException('Bạn không có quyền duyệt đơn nghỉ');
      // }

      // if (
      //   user.role === UserRole.DEPARTMENT_LEAD &&
      //   leave.user.departmentName !== user.departmentName
      // ) {
      //   throw new ForbiddenException('Bạn chỉ có thể duyệt đơn của nhân viên trong phòng ban mình');
      // }
      
      // --------------
      // Cách 2
      ForbiddenError
        .from(ability)
        .throwUnlessCan(Action.Approve, leave);
      
      if (leave.status !== LeaveRequestStatus.PENDING) {
        throw new BadRequestException('Đơn này không thể duyệt');
      }

      // lấy hoặc tạo balance
      const currentYear = new Date().getFullYear();
      const balance = await this.getOrCreateBalance(leave.userId, currentYear, manager);
      let warning: string | undefined;
      if((leave.leaveType === LeaveType.UNPAID) && Number(balance.unpaidLeaveUsed) >= 30) {
         warning = `Nhân viên này đã nghỉ không lương ${balance.unpaidLeaveUsed} ngày trong năm nay.`;
      }
      // cập nhật trạng thái đơn
      leave.status = LeaveRequestStatus.APPROVED;
      leave.approverId = user.id;
      leave.approvedAt = new Date();

      await manager.save(leave);

      if (leave.leaveType === LeaveType.COMPENSATORY) {
        const leaveDays = this.calculateLeaveDays(
          new Date(leave.startDate),
          new Date(leave.endDate),
          leave.startHalfDayType,
          leave.endHalfDayType,
        );

        balance.compensatoryBalance =
          Number(balance.compensatoryBalance) - leaveDays * 8;
      } else {
        balance.annualLeaveUsed =
          Number(balance.annualLeaveUsed) +
          Number(leave.paidLeaveDeduction);

        balance.unpaidLeaveUsed =
          Number(balance.unpaidLeaveUsed) +
        Number(leave.unpaidLeaveDeduction); 
      }

      await manager.save(balance);

      return {
        message: 'Duyệt đơn nghỉ thành công',
        data: leave,
        ...(warning && { warning }),
      };
    })
  }

  //Từ chối đơn nghỉ
  async rejectLeaveRequest(
    userId: number,
    requestId: number,
    dto: RejectLeaveDto,
  ) {
    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user) throw new NotFoundException('Không tìm thấy người duyệt');

    const leave = await this.leaveRequestRepo.findOne({
      where: { id: requestId },
      relations: ['user'],
    });
    if (!leave) throw new NotFoundException('Không tìm thấy đơn nghỉ');

    // Kiểm tra quyền
    const ability = this.caslAbilityFactory.createForUser(user);
    // ----- cách 1
    ForbiddenError.from(ability).throwUnlessCan(Action.Reject, leave);
    // ------ cách 2: từ chối được 
    // if (!ability.can(Action.Reject, LeaveRequest)) {
    //     throw new ForbiddenException('Bạn không có quyền duyệt đơn nghỉ');
    //   }

    //   if (
    //     user.role === UserRole.DEPARTMENT_LEAD &&
    //     leave.user.departmentName !== user.departmentName
    //   ) {
    //     throw new ForbiddenException('Bạn chỉ có thể duyệt đơn của nhân viên trong phòng ban mình');
    //   }

    if (leave.status !== LeaveRequestStatus.PENDING) {
      throw new BadRequestException('Đơn này không ở trạng thái chờ duyệt');
    }

    leave.status = LeaveRequestStatus.REJECTED;
    leave.rejectionReason = dto.rejectionReason;
    leave.approverId = userId;
    await this.leaveRequestRepo.save(leave);

    return {
      message: 'Đã từ chối đơn nghỉ',
      data: leave,
    };
  }

  /**
   * Nhân viên tự hủy đơn (chỉ khi PENDING)
   */
  async cancelLeaveRequest(userId: number, requestId: number) {
    const request = await this.leaveRequestRepo.findOneBy({
      id: requestId,
      userId,
    });

    if (!request) throw new NotFoundException('Không tìm thấy đơn nghỉ');

    if (request.status !== LeaveRequestStatus.PENDING) {
      throw new BadRequestException(
        'Chỉ có thể hủy đơn ở trạng thái chờ duyệt',
      );
    }

    request.status = LeaveRequestStatus.CANCELLED;
    await this.leaveRequestRepo.save(request);

    return {
      message: 'Đã hủy đơn nghỉ',
      data: request,
    };
  }

  // lấy chi tiết đơn xin nghỉ
  async leaveRequestDetail(user: User, id: number) {
    const leave = await this.leaveRequestRepo.findOne({
      where: { id },
      relations: ['user', 'approver', 'attachments'],
    });
    
    if (!leave) throw new NotFoundException('Không tìm thấy đơn xin nghỉ');

    // Kiểm tra quyền của người dùng đối với đơn cụ thể này
    const ability = this.caslAbilityFactory.createForUser(user);
    ForbiddenError.from(ability).throwUnlessCan(Action.Read, leave);

    const totalDays = this.calculateLeaveDays(
      new Date(leave.startDate),
      new Date(leave.endDate),
      leave.startHalfDayType,
      leave.endHalfDayType,
    );

    return {
      startDate: leave.startDate,
      endDate: leave.endDate,
      totalDays,
      leaveType: leave.leaveType,
      reason: leave.reason,
      attachments:
      leave.attachments?.map((att) => ({
        id: att.id,
        originalName: att.originalName,
        fileName: att.fileName,
      })) ?? [],
    };
  }

  // lấy file đính kèm
  async getLeaveRequestAttachments(user: User, attachmentId: number, res: Response) {
    const attachment = await this.leaveAttachmentRepo.findOne({
      where: { id: attachmentId },
      relations: ['leaveRequest', 'leaveRequest.user'], 
    });

  if (!attachment) {
    throw new NotFoundException('Không tìm thấy file');
  }

    // check quyền dựa trên đơn nghỉ
    const ability = this.caslAbilityFactory.createForUser(user);
    ForbiddenError.from(ability).throwUnlessCan(Action.Read, attachment.leaveRequest);

    const filePath = join(
      process.cwd(),
      'uploads',
      'leave',
      attachment.fileName,
    );

    //  Set header để xem inline, không tải xuống
    res.setHeader('Content-Type', attachment.mimeType);
    const encodedFileName = encodeURIComponent(
      attachment.originalName,
    );
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodedFileName}"`,
    );

    return res.sendFile(filePath);
  }

  // Tính số ngày nghỉ (startDate → endDate, inclusive)
  private calculateLeaveDays(startDate: Date, endDate: Date, startHalf: HalfDayType, endHalf: HalfDayType): number {
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);

    const diff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    let total = diff + 1;

    if (startHalf === HalfDayType.AFTERNOON) total -= 0.5;
    if (endHalf === HalfDayType.MORNING) total -= 0.5;

    return Math.max(0, total);
  }

  // lấy hoặc tạo quỹ nghỉ
  private async getOrCreateBalance(
    userId: number,
    year: number,
    manager?: EntityManager
  ): Promise<LeaveBalance> {
    const entityManager = manager ?? this.dataSource.manager
    let balance = await entityManager.findOne(LeaveBalance,{
      where: { userId, year },
    });

    if (balance) {
      return balance;
    }

    const user = await entityManager.findOne(User,{where:{id: userId}})
    if (!user) throw new NotFoundException('Không tìm thấy người dùng')
    balance = await this.leaveAccrualService.backfillLeaveForUser(user, entityManager);;

    return balance;
  }

  private async getSubTypeLimit(leaveType: LeaveType, leaveSubType: string): Promise<LeaveConfig | null> {
    return this.leaveConfigRepo.findOne({
      where: {
        leaveType,
        leaveSubType,
      },
    });
  }

  private async getUsedDaysForSubType(
    userId: number,
    subType: string,
    year: number,
    month?: number,
  ): Promise<number> {
    const query = this.leaveRequestRepo
      .createQueryBuilder('lr')
      .where('lr.userId = :userId', { userId })
      .andWhere('lr.leaveSubType = :subType', { subType })
      .andWhere('lr.status = :status', { status: LeaveRequestStatus.APPROVED });
    
    if (month !== undefined) {
      //tháng trong query là 1-12, month nhận vào là 0-11
      query.andWhere('MONTH(lr.startDate) = :month AND YEAR(lr.startDate) = :year', {
        month: month + 1,
        year,
      });
    } else {
      query.andWhere('YEAR(lr.startDate) = :year', { year });
    }

    const requests = await query.getMany();
    
    return requests.reduce(
      (total, req) =>
        total + this.calculateLeaveDays(new Date(req.startDate), new Date(req.endDate), req.startHalfDayType, req.endHalfDayType),
      0,
    );
  }

  private async validateLeaveSubType(leaveType: LeaveType, leaveSubType?: string) {
    if (
      leaveType === LeaveType.PAID ||
      leaveType === LeaveType.UNPAID ||
      leaveType === LeaveType.COMPENSATORY
    ) {
    if (leaveSubType) {
      throw new BadRequestException(
        `${leaveType} không được có leaveSubType`,
      );
    }
    return;
    }
    if (!leaveSubType) {
      throw new BadRequestException(
        `leaveSubType là bắt buộc cho ${leaveType}`,
      );
    }
    const config = await this.getSubTypeLimit(
      leaveType,
      leaveSubType,
    );
    if (!config) {
      throw new BadRequestException(
        `leaveSubType ${leaveSubType} không tồn tại trong hệ thống`,
      );
    }
  }
}
