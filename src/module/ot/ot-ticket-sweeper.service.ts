import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, In, DataSource } from 'typeorm';
import { OtPlanEmployee } from './entities/ot-plan-employee.entity';
import { OtPlanEmployeeStatus } from 'src/common/enums/ot/ot-employee-status.enum';
import { OtTimeSegment } from './entities/ot-time-segment.entity';
import { OtTimeSegmentHelper } from './helpers/ot-time-segment.helper';
import { OT_TICKET_CONSTANTS } from './ot-ticket.constants';
import dayjs from 'dayjs';
import { OtPlanStatus } from 'src/common/enums/ot/ot-status.enum';

const CRON_DAILY_00_01  = '1 0 * * *';

@Injectable()
export class OtTicketSweeperService {
  private readonly logger = new Logger(OtTicketSweeperService.name);

  constructor(
    @InjectRepository(OtPlanEmployee)
    private readonly otPlanEmployeeRepo: Repository<OtPlanEmployee>,
    private readonly otTimeSegmentHelper: OtTimeSegmentHelper,
    private readonly dataSource: DataSource,
  ) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async handleSweeper() {
    this.logger.log('Running OT Ticket Sweeper...');
    await this.autoCheckoutStaleTickets();
  }
  
  @Cron(CRON_DAILY_00_01)
  async handleAutoCancel(){
    this.logger.log('[OT_SWEEPER] Running auto cancel...');
    await this.autoCancelExpiredTickets();
  }

  private async autoCancelExpiredTickets() {
    const now = dayjs();

  const result = await this.dataSource
    .createQueryBuilder()
    .update(OtPlanEmployee)
    .set({ status: OtPlanEmployeeStatus.CANCELLED })
    .where('status = :status', { status: OtPlanEmployeeStatus.PENDING })
    .andWhere(`id IN (
      SELECT id FROM (
        SELECT ope.id FROM ot_plan_employees ope
        INNER JOIN ot_plans op ON op.id = ope.otPlanId
        WHERE op.status = :planStatus
        AND DATE_ADD(DATE(op.startTime), INTERVAL 2 DAY) <= :now
      ) AS expired
    )`, {
      planStatus: OtPlanStatus.APPROVED,
      now: now.toDate(),
    })
    .execute();

    if (result.affected === 0) {
      this.logger.debug('[OT_AUTO_CANCEL] Không có ticket nào cần hủy');
    } else {
      this.logger.log(`[OT_AUTO_CANCEL] Đã hủy ${result.affected} ticket quá hạn check-in`);
    }
  }

  private async autoCheckoutStaleTickets() {
    const now = dayjs();
    const checkInExpiredBefore  = now.subtract(OT_TICKET_CONSTANTS.AUTO_CHECKOUT_TIMEOUT_HOURS, 'hour');

    // Tìm các ticket INPROGRESS mà lúc checkin < now - 8h
    const tickNeedCheckout = await this.otPlanEmployeeRepo.find({
      where: {
        status: OtPlanEmployeeStatus.INPROGRESS,
        checkInTime: LessThan(checkInExpiredBefore .toDate()),
      },
      relations: ['otPlan'],
    });
    if (tickNeedCheckout.length === 0) {
      this.logger.debug('[OT_AUTO_CHECKOUT] Không có ticket nào cần auto checkout');
      return;
    }

    this.logger.log(`[OT_AUTO_CHECKOUT] Tìm thấy ${tickNeedCheckout.length} ticket cần auto checkout`);
    const queryRunner = this.dataSource.createQueryRunner();
    try {

      await queryRunner.connect(); 

      for (const ticket of tickNeedCheckout) {
        this.logger.log(`Auto-checking-out ticket ID: ${ticket.id}`);

        const checkInTime = dayjs(ticket.checkInTime);
        const planDurationMinutes = dayjs(ticket.otPlan.endTime).diff(dayjs(ticket.otPlan.startTime), 'minute');
        const autoCheckOutTime = checkInTime.add(planDurationMinutes, 'minute').toDate();

        // tính các khoảng ot của đơn ot này xem xem nó theo loại gì segments
        const segmentsData = await this.otTimeSegmentHelper.splitIntoSegments(
          ticket.checkInTime,
          autoCheckOutTime,
        );
        await queryRunner.startTransaction();
        try {
          const updateResult = await queryRunner.manager.update(OtPlanEmployee, 
            {
              id: ticket.id,
              status: OtPlanEmployeeStatus.INPROGRESS,
            },
            {
              checkOutTime: autoCheckOutTime,
              actualMinutes: planDurationMinutes,
              status: OtPlanEmployeeStatus.ABSENT,
              note: (ticket.note || '') + ' [Hệ thống tự động check-out do quá 8 giờ]',
            }
          )
          if(updateResult.affected === 0){
            this.logger.debug(`[OT_AUTO_CHECKOUT] Ticket ${ticket.id} đã được checkout trước`);
            await queryRunner.rollbackTransaction();
            continue;
          }
          const segmentsEntities = segmentsData.map(s => 
            queryRunner.manager.create(OtTimeSegment, {
              otPlanEmployeeId: ticket.id,
              ...s
            })
          );
          await queryRunner.manager.save(OtTimeSegment, segmentsEntities);
          await queryRunner.commitTransaction();
          this.logger.log(`[OT_AUTO_CHECKOUT] Đã auto checkout ticket ID: ${ticket.id}`);
        } catch (e) {
          await queryRunner.rollbackTransaction();
          this.logger.error(`Failed to auto-checkout ticket ${ticket.id}: ${e.message}`);
        }
      }
    } finally {
      await queryRunner.release();
    }
  }
}

