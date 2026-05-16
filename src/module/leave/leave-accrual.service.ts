import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, In, EntityManager, DataSource } from 'typeorm';
import { LeaveBalance } from './entities/leave-balance.entity';
import { User } from '../users/entities/user.entity';
import { EmploymentType } from 'src/common/enums/user-employeeType.enum';
import { UserStatus } from 'src/common/enums/user-status.enum';
import { LEAVE_CONSTANTS } from 'src/common/constants/leave.constants';
import dayjs from 'dayjs';
import { LEAVE_ERRORS } from './leave.errors';
import { HolidayService } from '../holiday/holiday.service';

@Injectable()
export class LeaveAccrualService {
  private readonly logger = new Logger(LeaveAccrualService.name);

  constructor(
    @InjectRepository(LeaveBalance)
    private leaveBalanceRepo: Repository<LeaveBalance>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private dataSource: DataSource,
    
    private holidayService: HolidayService,
  ) {}

  /**
   * Cron job chạy vào 00:05 ngày 1 hàng tháng
   *
   * Xử lý 2 trường hợp:
   *
   * TH1 - Nhân viên thử việc (PROBATION):
   *   - Phép tích lũy 1/tháng nhưng CHƯA được dùng.
   *   - Cron job vẫn cộng vào annualLeaveTotal để ghi nhận.
   *   - Khi lên chính thức (cập nhật employmentType = OFFICIAL),
   *     toàn bộ phép đã tích lũy sẽ được dùng ngay.
   *
   * TH2 - Nhân viên chính thức (OFFICIAL):
   *   - Phép tích lũy 1/tháng và được dùng ngay.
   */
  @Cron('5 0 1 * *') // 00:05 ngày 1 hàng tháng
  async accrueMonthlyLeave() {
    const now = dayjs();
    const currentYear = now.year();

    // Tháng vừa kết thúc (cron chạy ngày 1, tính cho tháng trước)
    const previousMonth = now.subtract(1, 'month');
    const month = previousMonth.month() + 1;
    const year = previousMonth.year();

    const activeUsers = await this.userRepo
        .createQueryBuilder('u')
        .where('u.status = :status', { status: UserStatus.ACTIVE })
        .andWhere('u.employmentType IN (:...types)', {
            types: [EmploymentType.PROBATION, EmploymentType.OFFICIAL],
        })
        .andWhere('u.startDate IS NOT NULL')
        .andWhere('u.startDate <= :now', { now: now.toDate() })
        .getMany();

    const totalWorkingDays = await this.calculateWorkingDaysInMonth(year, month);

    for (const user of activeUsers) {
      try {
        let balance = await this.leaveBalanceRepo.findOne({
            where: { userId: user.id, year: currentYear },
        });

        if (!balance) {
          balance = this.leaveBalanceRepo.create({
            userId: user.id,
            year: currentYear,
            annualLeaveTotal: 0,
            annualLeaveUsed: 0,
            unpaidLeaveUsed: 0,
            compensatoryBalance: 0,
          });
        }

        if (Number(balance.annualLeaveTotal) >= LEAVE_CONSTANTS.MAX_ANNUAL_LEAVE_PER_YEAR) {
          continue;
        }

        const startDate = dayjs(user.startDate);
        const isFirstMonth = startDate.year() === year && startDate.month() + 1 === month; // kiểm tra tháng đầu tiên đi làm của user

        let accrual: number;
        if (isFirstMonth) {
            const workedDays = await this.calculateWorkingDaysFromDate(startDate, year, month);
            accrual = this.calculateAccrual(workedDays, totalWorkingDays);
        } else {
            accrual = 1;
        }

        balance.annualLeaveTotal = Math.min(
          Number(balance.annualLeaveTotal) + accrual,
          LEAVE_CONSTANTS.MAX_ANNUAL_LEAVE_PER_YEAR,
        );

        await this.leaveBalanceRepo.save(balance);

        this.logger.debug(
          `[LeaveAccrual] User #${user.id} (${user.name}) tháng ${month}/${year} → +${accrual} phép`,
        );
      } catch (err) {
        this.logger.error(`[LeaveAccrual] Lỗi khi cộng phép cho user #${user.id}: ${err}`);
      }
    }
  }

  async backfillLeaveForUser(
    user: User,
  ): Promise<LeaveBalance> {
    if (!user.startDate) {
      this.logger.warn(
        ` User ${user.id} chưa có startDate, bỏ qua backfill`,
      );
      throw new BadRequestException(LEAVE_ERRORS.START_DATE_REQUIRED);
    }

    if (user.employmentType === EmploymentType.INTERN) {
      throw new BadRequestException(LEAVE_ERRORS.INTERN_NOT_ALLOWED);
    }

    const startDate = dayjs(user.startDate);
    const now = dayjs();
    const currentYear = now.year();

    // Kiểm tra nhân viên có startDate hợp lệ không
    if (startDate.isAfter(now)) {
      throw new BadRequestException(LEAVE_ERRORS.START_DATE_NOT_FUTURE);
    }

    // Tháng bắt đầu tính trong năm hiện tại
    // Nếu startDate trước năm nay thì từ tháng 1
    const firstMonthInYear =
      startDate.year() < currentYear ? 0 : startDate.month();

    // Tháng hiện tại (0-index)
    const currentMonth = now.month();

    let totalAccrual = 0;

    for (let m = firstMonthInYear; m <= currentMonth; m++){
      const isFirstMonth = startDate.year() === currentYear && m === startDate.month();
      if (isFirstMonth) {
          // Tháng đầu tiên: tính % ngày công từ startDate đến cuối tháng
          const totalWorkingDays = await this.calculateWorkingDaysInMonth(currentYear, m + 1);
          const workedDays = await this.calculateWorkingDaysFromDate(startDate, currentYear, m + 1);
          totalAccrual += this.calculateAccrual(workedDays, totalWorkingDays);
      } else {
          // Các tháng còn lại: cộng 1 phép
          totalAccrual += 1;
      }
    }

    totalAccrual = Math.min(totalAccrual, LEAVE_CONSTANTS.MAX_ANNUAL_LEAVE_PER_YEAR);

    let balance = await this.leaveBalanceRepo.findOne({
      where: { userId: user.id, year: currentYear },
    });

    if (!balance) {
      balance = this.leaveBalanceRepo.create({
        userId: user.id,
        year: currentYear,
        annualLeaveTotal: totalAccrual,
        annualLeaveUsed: 0,
        unpaidLeaveUsed: 0,
        compensatoryBalance: 0,
      });
    } else {
      balance.annualLeaveTotal = Math.min(
        Math.max(totalAccrual, Number(balance.annualLeaveTotal)),
        LEAVE_CONSTANTS.MAX_ANNUAL_LEAVE_PER_YEAR,
      );
    }

    balance = await this.leaveBalanceRepo.save(balance);

    this.logger.log(
      `Backfill user ${user.id} (${user.name}): totalAccrual = ${totalAccrual} → annualLeaveTotal = ${balance.annualLeaveTotal}`,
    );

    return balance;

  }

  // tính số ngày làm việc trong tháng
  private async calculateWorkingDaysInMonth(year: number, month: number): Promise<number> {
    const startOfMonth = dayjs(`${year}-${month}-01`).startOf('month');
    const endOfMonth = startOfMonth.endOf('month');

    const holidays = await this.holidayService.getHolidaysByYear(year);
    const holidaySet = new Set<string>();

    holidays.forEach(h => {
      let current = dayjs(h.startDate)
      const end = dayjs(h.endDate)
      while (current.isBefore(end) || current.isSame(end)){
        holidaySet.add(current.format('YYYY-MM-DD'))
        current = current.add(1, 'day')
      }
    })

    let workingDays = 0;
    let current = startOfMonth;
    while (current.isBefore(endOfMonth) || current.isSame(endOfMonth)){
      const day = current.day();
      const isWeekend = day === 0 || day === 6;
      const isHoliday = holidaySet.has(current.format('YYYY-MM-DD'));
      if (!isWeekend && !isHoliday) {
        workingDays++;
      }
      current = current.add(1, 'day')
    }
    return workingDays
  }

  //số ngày làm việc của người dùng từ startDate
  private async calculateWorkingDaysFromDate(startDate: dayjs.Dayjs, year: number, month: number): Promise<number> {
    const endOfMonth = dayjs(`${year}-${month}-01`).endOf('month')

    const holidays = await this.holidayService.getHolidaysByYear(year);
    const holidaySet = new Set<string>();

    holidays.forEach(h => {
        let current = dayjs(h.startDate);
        const end = dayjs(h.endDate);
        while (current.isBefore(end) || current.isSame(end, 'day')) {
            holidaySet.add(current.format('YYYY-MM-DD'));
            current = current.add(1, 'day');
        }
    });

    let workingDays = 0;
    let current = startDate;

    while (current.isBefore(endOfMonth) || current.isSame(endOfMonth, 'day')) {
      const day = current.day();
      const isWeekend = day === 0 || day === 6;
      const isHoliday = holidaySet.has(current.format('YYYY-MM-DD'));
      if (!isWeekend && !isHoliday) {
          workingDays++;
      }
      current = current.add(1, 'day');
    }
    return workingDays
  }

  // tính ra % công trong tháng để xem được bao nhiêu phép
  private calculateAccrual(workedDays: number, totalWorkingDays: number): number {
    const percentage = workedDays / totalWorkingDays;
    if (percentage < 0.5) return 0;
    if (percentage < 0.75) return 0.5;
    return 1;
  }
}
