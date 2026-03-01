import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, In, EntityManager, DataSource } from 'typeorm';
import { LeaveBalance } from './entities/leave-balance.entity';
import { User } from '../users/entities/user.entity';
import { EmploymentType } from 'src/common/enums/user-employeeType.enum';
import { UserStatus } from 'src/common/enums/user-status.enum';

@Injectable()
export class LeaveAccrualService {
  private readonly logger = new Logger(LeaveAccrualService.name);

  constructor(
    @InjectRepository(LeaveBalance)
    private leaveBalanceRepo: Repository<LeaveBalance>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private dataSource: DataSource,
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
    const now = new Date();
    const currentYear = now.getFullYear();

    this.logger.log(
      `Bắt đầu cộng phép tháng ${now.getMonth() + 1}/${currentYear}`,
    );

    // Lấy tất cả nhân viên đang hoạt động (PROBATION + OFFICIAL)
    // có startDate và đã bắt đầu làm rồi (startDate <= hôm nay)
    const activeUsers = await this.userRepo
      .createQueryBuilder('u')
      .where('u.status = :status', { status: UserStatus.ACTIVE })
      .andWhere('u.employmentType IN (:...types)', {
        types: [EmploymentType.PROBATION, EmploymentType.OFFICIAL],
      })
      .andWhere('u.startDate IS NOT NULL')
      .andWhere('u.startDate <= :now', { now })
      .getMany();

    this.logger.log(
      `Tìm thấy ${activeUsers.length} nhân viên cần cộng phép`,
    );

    let successCount = 0;
    let skipCount = 0;

    for (const user of activeUsers) {
      try {
        // Lấy hoặc tạo leave balance năm hiện tại
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

        // Kiểm tra tối đa 12 phép/năm
        if (Number(balance.annualLeaveTotal) >= 12) {
          this.logger.debug(
            `User ${user.id} (${user.name}) đã đủ 12 phép, bỏ qua`,
          );
          skipCount++;
          continue;
        }

        // Cộng thêm 1 phép
        balance.annualLeaveTotal = Number(balance.annualLeaveTotal) + 1;
        await this.leaveBalanceRepo.save(balance);

        this.logger.debug(
          `[LeaveAccrual] User #${user.id} (${user.name}) [${user.employmentType}] ` +
            `→ annualLeaveTotal: ${balance.annualLeaveTotal}`,
        );
        successCount++;
      } catch (err) {
        this.logger.error(
          `[LeaveAccrual] Lỗi khi cộng phép cho user #${user.id}: ${err}`,
        );
      }
    }

    this.logger.log(
      ` Hoàn tất: ${successCount} người được cộng phép, ${skipCount} người đã đủ tối đa`,
    );
  }

  async backfillLeaveForUser(
    user: User,
    manager?: EntityManager
  ): Promise<LeaveBalance> {
    if (!user.startDate) {
      this.logger.warn(
        ` User ${user.id} chưa có startDate, bỏ qua backfill`,
      );
      throw new Error('Nhân viên chưa có startDate');
    }

    const startDate = new Date(user.startDate);
    const now = new Date();
    const currentYear = now.getFullYear();

    // Kiểm tra nhân viên có startDate hợp lệ không
    if (startDate > now) {
      throw new Error('startDate không được là ngày trong tương lai');
    }

    // Tháng bắt đầu tính trong năm hiện tại
    // Nếu startDate trước năm nay thì từ tháng 1
    const firstMonthInYear =
      startDate.getFullYear() < currentYear ? 0 : startDate.getMonth();

    // Tháng hiện tại (0-index)
    const currentMonth = now.getMonth();

    // Số tháng cần cộng = (currentMonth - firstMonthInYear + 1), tối đa 12
    const monthsToAccrue = Math.min(
      Math.max(currentMonth - firstMonthInYear + 1, 0),
      12,
    );
    const entityManager = manager ?? this.dataSource.manager
    // Lấy hoặc tạo balance
    let balance = await entityManager.findOne(LeaveBalance,{
      where: { userId: user.id, year: currentYear },
    });

    if (!balance) {
      balance = entityManager.create(LeaveBalance,{
        userId: user.id,
        year: currentYear,
        annualLeaveTotal: monthsToAccrue,
        annualLeaveUsed: 0,
        unpaidLeaveUsed: 0,
        compensatoryBalance: 0,
      });
    } else {
      balance.annualLeaveTotal = Math.min(
        Math.max(monthsToAccrue, Number(balance.annualLeaveTotal)),
        12,
      );
    }

    balance = await entityManager.save(LeaveBalance,balance);

    this.logger.log(
      ` Backfill user ${user.id} (${user.name}): ` +
        `${monthsToAccrue} tháng → annualLeaveTotal = ${balance.annualLeaveTotal}`,
    );

    return balance;
  }
}
