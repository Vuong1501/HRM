import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, In } from 'typeorm';
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
import { LeaveAccrualService } from './leave-accrual.service';
import { MailService } from '../mail/mail.service';
import { DataSource } from 'typeorm';
import { LeaveAttachment } from './entities/leave_attachments.entity';
import { LeaveRequestQueryBuilder } from './leave-request.query-builder';
import { LeaveListQueryDto } from './dto/leave-list-query.dto';
import { UpdateLeaveRequestDto } from './dto/update-leave-request.dto';
import { CancelLeaveRequestDto } from './dto/cancel-leave-request.dto';
import { StorageService } from 'src/common/storage/storage.service';
import { LEAVE_ERRORS } from './leave.errors';

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

    private readonly queryBuilder: LeaveRequestQueryBuilder,
    private leaveAccrualService: LeaveAccrualService,
    private mailService: MailService,
    private dataSource: DataSource,
    private storageService: StorageService
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

    // nghỉ bảo hiểm bắt buộc có file đính kèm
    if (dto.leaveType === LeaveType.INSURANCE && (!files || files.length === 0)) {
      throw new BadRequestException(LEAVE_ERRORS.INSURANCE_REQUIRES_ATTACHMENT);
    }

    //Tìm user
    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user) throw new NotFoundException(LEAVE_ERRORS.EMPLOYEE_NOT_FOUND);

    // kiểm tra type nhân viên
    if (
      (dto.leaveType === LeaveType.PAID || dto.leaveType === LeaveType.INSURANCE) &&
      user.employmentType !== EmploymentType.OFFICIAL
    ) {
      throw new ForbiddenException(LEAVE_ERRORS.NOT_OFFICIAL_EMPLOYEE);
    }

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // kiểm tra ngày bắt đầu và kết thúc
    if (startDate > endDate) {
      throw new BadRequestException(LEAVE_ERRORS.INVALID_DATE_RANGE);
    }

    if (startDate.getTime() === endDate.getTime()) {
      if (dto.startHalfDayType === HalfDayType.AFTERNOON && dto.endHalfDayType === HalfDayType.MORNING) {
        throw new BadRequestException(LEAVE_ERRORS.INVALID_HALF_DAY);
      }
    }
    if (startDate < today) {
      // Cho phép ngày trong quá khứ nếu cùng tháng hiện tại
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();

      const startMonth = startDate.getMonth();
      const startYear = startDate.getFullYear();

      if (startMonth !== currentMonth || startYear !== currentYear) {
        throw new BadRequestException(LEAVE_ERRORS.PAST_DATE_NOT_ALLOWED);
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
            throw new BadRequestException({
              ...LEAVE_ERRORS.SCHEDULE_CONFLICT,
              details: `Trùng với đơn ${req.startDate} ${req.startHalfDayType} - ${req.endDate} ${req.endHalfDayType}`,
            });
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
        throw new BadRequestException(LEAVE_ERRORS.SUBTYPE_REQUIRED);
      }
      const config = await this.getSubTypeLimit(dto.leaveType, dto.leaveSubType)
      if (!config) {
        throw new BadRequestException(LEAVE_ERRORS.SUBTYPE_NOT_FOUND);
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
        throw new BadRequestException({
          ...LEAVE_ERRORS.SUBTYPE_QUOTA_EXCEEDED,
          details: `Bạn chỉ còn ${remaining} ngày cho loại nghỉ ${dto.leaveSubType}`,
        });
      }
    } else if (dto.leaveType === LeaveType.PAID) {
      const annualRemaining = Number(balance.annualLeaveTotal) - Number(balance.annualLeaveUsed);
      if (annualRemaining < leaveDays) {
        throw new BadRequestException({
          ...LEAVE_ERRORS.INSUFFICIENT_ANNUAL_LEAVE,
          details: `Bạn chỉ còn ${annualRemaining} ngày phép năm, không đủ cho ${leaveDays} ngày`,
        });
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
        throw new BadRequestException({
          ...LEAVE_ERRORS.INSUFFICIENT_COMPENSATORY,
          details: `Bạn chỉ còn ${compBalance} giờ nghỉ bù, không đủ cho ${requiredHours} giờ yêu cầu`,
        });
      }
    }

    // Tạo đơn nghỉ
    await this.validateLeaveSubType(dto.leaveType, dto.leaveSubType);

    //tạo transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
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

      // lưu file nếu có file
      if (files && files.length > 0) {
        const attachments = await Promise.all(
          files.map(async (file) => {
            const fileKey = await this.storageService.uploadFile(file, 'leave');  // ← upload lên MinIO

            return queryRunner.manager.create(LeaveAttachment, {
              leaveRequestId: savedLeave.id,
              originalName: file.originalname,
              fileKey,          
              size: file.size,
              mimeType: file.mimetype,
            });
          }),
        );
        await queryRunner.manager.save(attachments);
      }
    const lead = await this.userRepo.findOne({
      where : {
        departmentName: user.departmentName,
        role: UserRole.DEPARTMENT_LEAD
      }
    })
    
    if(lead){
      await this.mailService.sendMailWithRetry(
        () => this.mailService.sendLeaveRequestNotification(
          lead.email,
          user.name,
          user.departmentName,
          startDate,
          endDate,
        ),
        'SEND_LEAVE_NOTIFICATION_FAILED',
      );
    }
    await queryRunner.commitTransaction();
      
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
    if (!user) throw new NotFoundException(LEAVE_ERRORS.EMPLOYEE_NOT_FOUND);

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

    // lấy ra đơn nghỉ
    const leave = await this.leaveRequestRepo.findOne({
      where: { id: requestId },
      relations: ['user'],
    });
    if (!leave) throw new NotFoundException(LEAVE_ERRORS.LEAVE_NOT_FOUND);

    //lấy ra id người đang đăng nhập để kiểm tra quyền 
    const user = await this.userRepo.findOneBy({id: userId})
    if (!user) throw new NotFoundException(LEAVE_ERRORS.APPROVER_NOT_FOUND);
    if (
      user.role === UserRole.DEPARTMENT_LEAD &&
      leave.user.departmentName !== user.departmentName
    ) {
      throw new ForbiddenException(LEAVE_ERRORS.APPROVE_OWN_DEPARTMENT_ONLY);
    }

    if (leave.status !== LeaveRequestStatus.PENDING) {
      throw new BadRequestException(LEAVE_ERRORS.CANNOT_APPROVE);
    }

    // lấy hoặc tạo balance
    const currentYear = new Date().getFullYear();
    const balance = await this.getOrCreateBalance(leave.userId, currentYear);
    let warning: string | undefined;
    if((leave.leaveType === LeaveType.UNPAID) && Number(balance.unpaidLeaveUsed) >= 30) {
        warning = `Nhân viên này đã nghỉ không lương ${balance.unpaidLeaveUsed} ngày trong năm nay.`;
    }


    await this.dataSource.transaction(async (manager) => {

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

      // gửi mail
      const hrs = await this.userRepo.find({
        where: { role: UserRole.HR },
      });

      await Promise.all(
        hrs.map((hr) =>
          this.mailService.sendMailWithRetry(
            () => this.mailService.sendLeaveApprovedNotification(
              hr.email,
              leave.user.name,
              new Date(leave.startDate),
              new Date(leave.endDate),
            ),
            'SEND_LEAVE_APPROVED_FAILED',
          ),
        ),
      );

      return {
        message: 'Duyệt đơn nghỉ thành công',
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
    if (!user) throw new NotFoundException(LEAVE_ERRORS.APPROVER_NOT_FOUND);

    const leave = await this.leaveRequestRepo.findOne({
      where: { id: requestId },
      relations: ['user'],
    });
    if (!leave) throw new NotFoundException(LEAVE_ERRORS.LEAVE_NOT_FOUND);
    if (
      user.role === UserRole.DEPARTMENT_LEAD &&
      leave.user.departmentName !== user.departmentName
    ) {
      throw new ForbiddenException(LEAVE_ERRORS.REJECT_OWN_DEPARTMENT_ONLY);
    }

    if (leave.status !== LeaveRequestStatus.PENDING) {
      throw new BadRequestException(LEAVE_ERRORS.NOT_PENDING_STATUS);
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

  // Nhân viên tự hủy đơn nghỉ
  async cancelLeaveRequest(userId: number, requestId: number, dto: CancelLeaveRequestDto) {

    const leaveRequest = await this.leaveRequestRepo.findOne({
      where: { id: requestId },
      relations: ['attachments'], // để xóa file đính kèm nếu có
    });

    if (!leaveRequest) throw new NotFoundException(LEAVE_ERRORS.LEAVE_NOT_FOUND);
    if (leaveRequest.userId !== userId) {
      throw new ForbiddenException(LEAVE_ERRORS.CANCEL_OWN_ONLY);
    }

    if (
      leaveRequest.status !== LeaveRequestStatus.PENDING &&
      leaveRequest.status !== LeaveRequestStatus.APPROVED
    ) {
      throw new BadRequestException(LEAVE_ERRORS.CANNOT_CANCEL);
    }

    if (leaveRequest.status === LeaveRequestStatus.APPROVED && !dto.cancelReason?.trim()) {
      throw new BadRequestException(LEAVE_ERRORS.CANCEL_REASON_REQUIRED);
    }

    const currentYear = new Date().getFullYear();
    const balance = leaveRequest.status === LeaveRequestStatus.APPROVED
      ? await this.getOrCreateBalance(leaveRequest.userId, currentYear)
      : null;
    // bắt đầu transaction
    await this.dataSource.transaction(async (manager) => {

      if (leaveRequest.status === LeaveRequestStatus.APPROVED && balance) {
        if (leaveRequest.leaveType === LeaveType.COMPENSATORY) {
          const leaveDays = this.calculateLeaveDays(
            new Date(leaveRequest.startDate),
            new Date(leaveRequest.endDate),
            leaveRequest.startHalfDayType,
            leaveRequest.endHalfDayType,
          );
          // Hoàn trả giờ bù
          balance.compensatoryBalance = Number(balance.compensatoryBalance) + leaveDays * 8;
        } else {
          // Hoàn trả phép năm và không lương 
          balance.annualLeaveUsed = Number(balance.annualLeaveUsed) - Number(leaveRequest.paidLeaveDeduction);
          balance.unpaidLeaveUsed = Number(balance.unpaidLeaveUsed) - Number(leaveRequest.unpaidLeaveDeduction);
        }
        await manager.save(balance);
      }

    // Xóa file trên MinIO thay vì disk
      if (leaveRequest.attachments?.length > 0) {
        await Promise.all(
          leaveRequest.attachments.map((att) =>
            this.storageService.deleteFile(att.fileKey).catch(() => {}),
          ),
        );
        await manager.delete(LeaveAttachment, { leaveRequestId: leaveRequest.id });
      }

      leaveRequest.status = LeaveRequestStatus.CANCELLED;
      leaveRequest.cancelReason = dto.cancelReason ?? null;
      leaveRequest.paidLeaveDeduction = 0;
      leaveRequest.unpaidLeaveDeduction = 0;
      await manager.save(leaveRequest);

      return {
        message: 'Đã hủy đơn nghỉ'
      };
    })
  }

  //cập nhật đơn xin nghỉ
  async updateLeaveRequest(
    user: User, 
    requestId: number, 
    dto: UpdateLeaveRequestDto,
    files: Express.Multer.File[],
  ) {

    const leave = await this.leaveRequestRepo.findOne({
      where: { id: requestId },
      relations: ['user', 'attachments'],
    });
    if (!leave) throw new NotFoundException(LEAVE_ERRORS.LEAVE_NOT_FOUND);

    if (
      user.role === UserRole.EMPLOYEE &&
      leave.userId !== user.id
    ) {
      throw new ForbiddenException(LEAVE_ERRORS.ONLY_UPDATE_OWN);
    }

    if (leave.status !== LeaveRequestStatus.PENDING) {
      throw new BadRequestException(LEAVE_ERRORS.ONLY_UPDATE_PENDING);
    }
    Object.assign(leave, dto);
    const startDate = new Date(leave.startDate);
    const endDate = new Date(leave.endDate);

    //  Validate ngày
    if (startDate > endDate) {
      throw new BadRequestException(LEAVE_ERRORS.INVALID_DATE_RANGE);
    }

    if (
      startDate.getTime() === endDate.getTime() &&
      leave.startHalfDayType === HalfDayType.AFTERNOON &&
      leave.endHalfDayType === HalfDayType.MORNING
    ) {
      throw new BadRequestException(LEAVE_ERRORS.INVALID_HALF_DAY);
    }
    //  Check trùng lịch (loại trừ chính nó)
    const existingRequests = await this.leaveRequestRepo.find({
      where: {
        userId: leave.userId,
        status: In([
          LeaveRequestStatus.APPROVED,
          LeaveRequestStatus.PENDING,
        ]),
        id: Not(requestId),
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
            // if (sHalf === HalfDayType.MORNING || eHalf === HalfDayType.AFTERNOON) return [1, 2];
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
          const newSlots = getSlots(d, newStart, newEnd, leave.startHalfDayType, leave.endHalfDayType);
          const oldSlots = getSlots(d, reqStart, reqEnd, req.startHalfDayType, req.endHalfDayType);
          
          if (newSlots.some(s => oldSlots.includes(s))) {
            throw new BadRequestException({
              ...LEAVE_ERRORS.SCHEDULE_CONFLICT,
              details: `Trùng với đơn ${req.startDate} ${req.startHalfDayType} - ${req.endDate} ${req.endHalfDayType}`,
            });
          }
        }
      }
    }

    //  Tính số ngày nghỉ
    const leaveDays = this.calculateLeaveDays(
      startDate,
      endDate,
      leave.startHalfDayType,
      leave.endHalfDayType,
    );

    //  Lấy balance
    const currentYear = startDate.getFullYear();
    const balance = await this.getOrCreateBalance(
      leave.userId,
      currentYear,
    );

    let paidDeduction = 0;
    let unpaidDeduction = 0;

    //  Validate theo leaveType 

    if (
      leave.leaveType === LeaveType.PERSONAL_PAID ||
      leave.leaveType === LeaveType.INSURANCE
    ) {
      if (!leave.leaveSubType) {
        throw new BadRequestException(LEAVE_ERRORS.SUBTYPE_REQUIRED);
      }

      const config = await this.getSubTypeLimit(
        leave.leaveType,
        leave.leaveSubType,
      );

      if (!config) {
        throw new BadRequestException(LEAVE_ERRORS.SUBTYPE_NOT_FOUND);
      }

      const limit = Number(config.limit);

      const usedDays = await this.getUsedDaysForSubType(
        leave.userId,
        leave.leaveSubType,
        currentYear,
        config.isPerMonth ? startDate.getMonth() : undefined,
        requestId, // loại trừ chính nó
      );

      const remaining = limit - usedDays;

      if (leaveDays > remaining) {
        throw new BadRequestException({
          ...LEAVE_ERRORS.SUBTYPE_QUOTA_EXCEEDED,
          details: `Bạn chỉ còn ${remaining} ngày cho loại nghỉ ${leave.leaveSubType}`,
        });
      }
    }

    else if (leave.leaveType === LeaveType.PAID) {
      const annualRemaining =
        Number(balance.annualLeaveTotal) -
        Number(balance.annualLeaveUsed);

      if (annualRemaining < leaveDays) {
        throw new BadRequestException({
          ...LEAVE_ERRORS.INSUFFICIENT_ANNUAL_LEAVE,
          details: `Bạn chỉ còn ${annualRemaining} ngày phép năm`,
        });
      }

      paidDeduction = leaveDays;
    }

    else if (leave.leaveType === LeaveType.UNPAID) {
      unpaidDeduction = leaveDays;
    }

    else if (leave.leaveType === LeaveType.COMPENSATORY) {
      const compBalance = Number(balance.compensatoryBalance);
      const requiredHours = leaveDays * 8;

      if (requiredHours > compBalance) {
        throw new BadRequestException(LEAVE_ERRORS.INSUFFICIENT_COMPENSATORY);
      }
    }

    //reset lại deduction 
    leave.paidLeaveDeduction = paidDeduction;
    leave.unpaidLeaveDeduction = unpaidDeduction;

    await this.leaveRequestRepo.save(leave);

    // Validate file INSURANCE
    if (leave.leaveType === LeaveType.INSURANCE) {
      const hasOldFiles = leave.attachments?.length > 0;
      const hasNewFiles = files?.length > 0;

      if (!hasOldFiles && !hasNewFiles) {
        throw new BadRequestException(LEAVE_ERRORS.INSURANCE_REQUIRES_ATTACHMENT);
      }
    }

    //transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      // lưu file mới
      if (files && files.length > 0) {
        //xóa file cũ
        if (leave.attachments?.length) {
          await Promise.all(
            leave.attachments.map((att) =>
              this.storageService.deleteFile(att.fileKey).catch(() => {}),
            ),
          );
          await queryRunner.manager.delete(LeaveAttachment, { leaveRequestId: leave.id });
        }
        // lưu file mới
        const attachments = await Promise.all(
          files.map(async (file) => {
            const fileKey = await this.storageService.uploadFile(file, 'leave');

            return queryRunner.manager.create(LeaveAttachment, {
              leaveRequestId: leave.id, 
              originalName: file.originalname,
              fileKey,         
              size: file.size,
              mimeType: file.mimetype,
            });
          }),
        );
        await queryRunner.manager.save(attachments);
      }

      await queryRunner.commitTransaction();
      return {
        message: 'Cập nhật đơn nghỉ thành công',
        data: leave,
        leaveDays,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // lấy chi tiết đơn xin nghỉ
  async leaveRequestDetail(user: User, id: number) {
    const leave = await this.leaveRequestRepo.findOne({
      where: { id },
      relations: ['user', 'approver', 'attachments'],
    });
    
    if (!leave) throw new NotFoundException(LEAVE_ERRORS.LEAVE_NOT_FOUND);

    if (
      user.role === UserRole.EMPLOYEE &&
      leave.userId !== user.id
    ) {
      throw new ForbiddenException(LEAVE_ERRORS.ONLY_VIEW_OWN);
    }

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
        originalName: att.originalName
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
    throw new NotFoundException(LEAVE_ERRORS.ATTACHMENT_NOT_FOUND);
  }

  if (
    user.role === UserRole.EMPLOYEE &&
    attachment.leaveRequest.userId !== user.id
  ) {
    throw new ForbiddenException(LEAVE_ERRORS.VIEW_ATTACHMENT_FORBIDDEN);
  }

    const fileStream = await this.storageService.getFileStream(attachment.fileKey);

    //  Set header để xem inline, không tải xuống
    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${attachment.originalName}"`,
    );

    fileStream.pipe(res); 
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
  ): Promise<LeaveBalance> {
    let balance = await this.leaveBalanceRepo.findOne({
      where: { userId, year },
    });

    if (balance) {
      return balance;
    }

    const user = await this.userRepo.findOne({where:{id: userId}})
    if (!user) throw new NotFoundException(LEAVE_ERRORS.USER_NOT_FOUND)
    balance = await this.leaveAccrualService.backfillLeaveForUser(user);

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
    requestId?: number
  ): Promise<number> {
    const query = this.leaveRequestRepo
      .createQueryBuilder('lr')
      .where('lr.userId = :userId', { userId })
      .andWhere('lr.leaveSubType = :subType', { subType })
      .andWhere('lr.status = :status', { status: LeaveRequestStatus.APPROVED });

    if (requestId) {
      query.andWhere('lr.id != :excludeId', {
        excludeId: requestId,
      });
    }
    
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
      throw new BadRequestException(LEAVE_ERRORS.SUBTYPE_NOT_ALLOWED);
    }
    return;
    }
    if (!leaveSubType) {
      throw new BadRequestException(LEAVE_ERRORS.SUBTYPE_REQUIRED);
    }
    const config = await this.getSubTypeLimit(
      leaveType,
      leaveSubType,
    );
    if (!config) {
      throw new BadRequestException(LEAVE_ERRORS.SUBTYPE_INVALID);
    }
  }
}
