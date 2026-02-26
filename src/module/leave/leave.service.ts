import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, Between, In } from 'typeorm';
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
import { config } from 'process';

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
    private leaveAccrualService: LeaveAccrualService,
  ) {}

   //Tạo đơn xin nghỉ
  async createLeaveRequest(userId: number, dto: CreateLeaveRequestDto) {
    const user = await this.userRepo.findOneBy({ id: userId });
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
    const leaveRequest = this.leaveRequestRepo.create({
      userId,
      leaveType: dto.leaveType,
      leaveSubType: dto.leaveSubType || null,
      startDate,
      endDate,
      startHalfDayType: dto.startHalfDayType,
      endHalfDayType: dto.endHalfDayType,
      reason: dto.reason,
      status: LeaveRequestStatus.PENDING
    });

    const saved = await this.leaveRequestRepo.save(leaveRequest);

    // if (saved.missingCompHours > 0) {

    //   await this.otService.createCompensateOT({
    //     userId,
    //     hours: saved.missingCompHours,
    //     leaveRequestId: saved.id,
    //   });

    // }

    return {
      message: 'Tạo đơn xin nghỉ thành công',
      data: saved,
      leaveDays,
      breakdown: {
        inQuota: (dto.leaveType === LeaveType.PERSONAL_PAID || dto.leaveType === LeaveType.INSURANCE) ? leaveDays : 0,
        paidDeduction,
        unpaidDeduction,
      },
    };
  }

  /**
   * Xem danh sách đơn nghỉ của mình
   */
  async getMyLeaveRequests(userId: number) {
    return this.leaveRequestRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
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

  /**
   * Lấy danh sách đơn chờ duyệt (cho Department Lead / Admin)
   */
  async getPendingRequests(approverId: number) {
    const approver = await this.userRepo.findOneBy({ id: approverId });
    if (!approver) throw new NotFoundException('Không tìm thấy người duyệt');

    const queryBuilder = this.leaveRequestRepo
      .createQueryBuilder('lr')
      .leftJoinAndSelect('lr.user', 'user')
      .where('lr.status = :status', { status: LeaveRequestStatus.PENDING });

    // Department Lead chỉ thấy đơn của nhân viên cùng phòng ban
    if (approver.role === UserRole.DEPARTMENT_LEAD) {
      queryBuilder.andWhere('user.departmentName = :dept', {
        dept: approver.departmentName,
      });
    }
    // Admin (BOD) thấy tất cả

    queryBuilder.orderBy('lr.createdAt', 'DESC');

    const requests = await queryBuilder.getMany();

    // Kèm thông tin leave history cho mỗi nhân viên
    const result = await Promise.all(
      requests.map(async (req) => {
        const currentYear = new Date().getFullYear();
        const balance = await this.leaveBalanceRepo.findOne({
          where: { userId: req.userId, year: currentYear },
        });

        return {
          ...req,
          employeeLeaveInfo: balance
            ? {
                annualLeaveUsed: Number(balance.annualLeaveUsed),
                annualLeaveTotal: Number(balance.annualLeaveTotal),
                unpaidLeaveUsed: Number(balance.unpaidLeaveUsed),
                compensatoryBalance: Number(balance.compensatoryBalance),
              }
            : null,
        };
      }),
    );

    return result;
  }

  /**
   * Duyệt đơn nghỉ
   */
  // async approveLeaveRequest(approverId: number, requestId: number) {
  //   const approver = await this.userRepo.findOneBy({ id: approverId });
  //   if (!approver) throw new NotFoundException('Không tìm thấy người duyệt');

  //   const request = await this.leaveRequestRepo.findOne({
  //     where: { id: requestId },
  //     relations: ['user'],
  //   });
  //   if (!request) throw new NotFoundException('Không tìm thấy đơn nghỉ');

  //   if (request.status !== LeaveRequestStatus.PENDING) {
  //     throw new BadRequestException('Đơn này không ở trạng thái chờ duyệt');
  //   }

  //   // Kiểm tra quyền: DeptLead chỉ duyệt trong phòng ban mình
  //   if (
  //     approver.role === UserRole.DEPARTMENT_LEAD &&
  //     request.user.departmentName !== approver.departmentName
  //   ) {
  //     throw new ForbiddenException('Bạn không có quyền duyệt đơn này');
  //   }

  //   // Kiểm tra cảnh báo unpaid leave >= 30 ngày
  //   const currentYear = new Date().getFullYear();
  //   let balance = await this.getOrCreateBalance(request.userId, currentYear);

  //   let warning: string | undefined;
  //   if (
  //     (request.leaveType === LeaveType.UNPAID || Number(request.unpaidLeaveDeduction) > 0) &&
  //     Number(balance.unpaidLeaveUsed) >= 30
  //   ) {
  //     warning = `Nhân viên này đã nghỉ không lương ${balance.unpaidLeaveUsed} ngày trong năm nay. Vẫn duyệt?`;
  //   }

  //   // Cập nhật trạng thái
  //   request.status = LeaveRequestStatus.APPROVED;
  //   request.approverId = approverId;
  //   request.approvedAt = new Date();
  //   await this.leaveRequestRepo.save(request);

  //   // Cập nhật leave balance dựa trên deduction đã tính
  //   if (request.leaveType === LeaveType.COMPENSATORY) {
  //     const leaveDays = this.calculateLeaveDays(
  //       new Date(request.startDate),
  //       new Date(request.endDate),
  //       request.startHalfDayType,
  //       request.endHalfDayType,
  //     );
  //     balance.compensatoryBalance = Number(balance.compensatoryBalance) - leaveDays * 8;
  //   } else {
  //     // Các loại nghỉ khác (PAID, UNPAID, PERSONAL_PAID, INSURANCE)
  //     // đều sử dụng paidLeaveDeduction và unpaidLeaveDeduction
  //     balance.annualLeaveUsed = Number(balance.annualLeaveUsed) + Number(request.paidLeaveDeduction);
  //     balance.unpaidLeaveUsed = Number(balance.unpaidLeaveUsed) + Number(request.unpaidLeaveDeduction);
  //   }

  //   await this.leaveBalanceRepo.save(balance);

  //   return {
  //     message: 'Duyệt đơn nghỉ thành công',
  //     data: request,
  //     ...(warning && { warning }),
  //   };
  // }

  /**
   * Từ chối đơn nghỉ
   */
  async rejectLeaveRequest(
    approverId: number,
    requestId: number,
    dto: RejectLeaveDto,
  ) {
    const approver = await this.userRepo.findOneBy({ id: approverId });
    if (!approver) throw new NotFoundException('Không tìm thấy người duyệt');

    const request = await this.leaveRequestRepo.findOne({
      where: { id: requestId },
      relations: ['user'],
    });
    if (!request) throw new NotFoundException('Không tìm thấy đơn nghỉ');

    if (request.status !== LeaveRequestStatus.PENDING) {
      throw new BadRequestException('Đơn này không ở trạng thái chờ duyệt');
    }

    // Kiểm tra quyền
    if (
      approver.role === UserRole.DEPARTMENT_LEAD &&
      request.user.departmentName !== approver.departmentName
    ) {
      throw new ForbiddenException('Bạn không có quyền từ chối đơn này');
    }

    request.status = LeaveRequestStatus.REJECTED;
    request.rejectionReason = dto.rejectionReason;
    request.approverId = approverId;
    await this.leaveRequestRepo.save(request);

    return {
      message: 'Đã từ chối đơn nghỉ',
      data: request,
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

    const user = await this.userRepo.findOneBy({id: userId})
    if (!user) throw new NotFoundException('Không tìm thấy người dùng')
    balance = await this.leaveAccrualService.backfillLeaveForUser(user);;

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
      // Lưu ý: tháng trong query là 1-12, month nhận vào là 0-11
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
