import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import dayjs from 'dayjs';
import { MAIL_ERRORS } from './mail.errors';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OutboxMail } from './entities/outbox-mail.entity';
import { OutboxStatus } from '../../common/enums/outbox-status.enum';

const MAIL_MAX_RETRIES = 5;
const MAIL_RETRY_DELAY_MS = 2000;

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  constructor(
    private readonly mailerService: MailerService,
    @InjectRepository(OutboxMail)
    private readonly outboxRepo: Repository<OutboxMail>,
  ) {}

  async sendMailWithRetry(
    sendFn: () => Promise<void>,
    errorCode: keyof typeof MAIL_ERRORS,
    outboxId?: number,
    isCronjobSweep: boolean = false,
  ): Promise<void> {
    const maxRetries = isCronjobSweep ? 1 : MAIL_MAX_RETRIES;
    const delayMsConfig = MAIL_RETRY_DELAY_MS;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await sendFn();
        if (outboxId) {
          await this.outboxRepo.update(outboxId, { status: OutboxStatus.SUCCESS });
        }
        return;
      } catch (error) {
        const isLastAttempt = attempt === maxRetries;

        this.logger.warn(
          `[${MAIL_ERRORS[errorCode].code}] attempt ${attempt}/${maxRetries} failed: ${error.message}`
        );

        if (isLastAttempt) {
          this.logger.error(
            `[${MAIL_ERRORS[errorCode].code}] failed after ${maxRetries} retries`
          );

          if (outboxId) {
            await this.outboxRepo.update(outboxId, {
              status: OutboxStatus.FAILED,
              errorReason: error.message,
            }).catch(e => this.logger.error('Failed to update outbox status to FAILED', e));
          }

          throw new InternalServerErrorException({
            ...MAIL_ERRORS[errorCode],
            details: error.message,
          });
        }

        const delayMs = delayMsConfig * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  // hr gửi mail mời nhân viên mới
  async sendInvite(email: string, link: string): Promise<void> {
    await this.mailerService.sendMail({
      to: email,
      subject: 'Invitation to HR System',
      template: 'invite',
      context: {link}
    });
  }

  // nhân viên gửi mail thông báo cho lead dep
  async sendLeaveRequestNotification(
    to: string, 
    employeeName: string,
    departmentName: string,
    startDate: Date,
    endDate: Date,
    ): Promise<void> {
      await this.mailerService.sendMail({
        to: to,
        subject: 'Leave Request Notification',
        template: 'leave-request-notification',
        context: {
          employeeName,
          departmentName,
          startDate: dayjs(startDate).format('DD MMM YYYY'),
          endDate: dayjs(endDate).format('DD MMM YYYY'),
        },
      });
  }

  // gửi thông báo cho hr là có đơn xin nghỉ đã được duyệt
  async sendLeaveApprovedNotification(
    to: string,
    employeeName: string,
    startDate: Date,
    endDate: Date,
  ): Promise<void> {
    await this.mailerService.sendMail({
      to: to,
      subject: 'Leave Request Approved',
      template: 'leave-approved',
      context: {
        employeeName,
        startDate: dayjs(startDate).format('DD MMM YYYY'),
        endDate: dayjs(endDate).format('DD MMM YYYY'),
      },
    });
  }

  async sendOtPlanApproved(
    to: string,
    employeeName: string,
    startTime: Date,
    endTime: Date,
    reason: string,
  ): Promise<void> {
    await this.mailerService.sendMail({
      to,
      subject: 'Thông báo kế hoạch OT đã được duyệt',
      template: 'ot-approved',
      context: {
        employeeName,
        startTime: dayjs(startTime).format('HH:mm DD/MM/YYYY'),
        endTime: dayjs(endTime).format('HH:mm DD/MM/YYYY'),
        reason,
      },
    });
  }

  async sendOtPlanSubmitted(
    to: string,
    creatorName: string,
    departmentName: string,
    startTime: Date,
    endTime: Date,
    reason: string,
  ): Promise<void> {
    await this.mailerService.sendMail({
      to,
      subject: 'Thông báo có kế hoạch OT mới cần duyệt',
      template: 'ot-submitted',
      context: {
        creatorName,
        departmentName,
        startTime: dayjs(startTime).format('HH:mm DD/MM/YYYY'),
        endTime: dayjs(endTime).format('HH:mm DD/MM/YYYY'),
        reason,
      },
    });
  }

  async sendOtPlanRejected(
    to: string,
    creatorName: string,
    startTime: Date,
    endTime: Date,
    rejectedReason: string,
  ): Promise<void> {
    await this.mailerService.sendMail({
      to,
      subject: 'Thông báo: Kế hoạch OT đã BỊ TỪ CHỐI',
      template: 'ot-rejected',
      context: {
        creatorName,
        startTime: dayjs(startTime).format('HH:mm DD/MM/YYYY'),
        endTime: dayjs(endTime).format('HH:mm DD/MM/YYYY'),
        rejectedReason,
      },
    });
  }

  // lead nhận mail khi nhân viên nộp báo cáo OT
  async sendOtTicketSubmitted(
    to: string,
    employeeName: string,
    departmentName: string,
    checkInTime: Date,
    checkOutTime: Date,
    actualMinutes: number,
    workContent: string,
  ): Promise<void> {
    await this.mailerService.sendMail({
      to,
      subject: 'Thông báo: Có báo cáo OT mới cần duyệt',
      template: 'ot-ticket-submitted',
      context: {
        employeeName,
        departmentName,
        checkInTime: dayjs(checkInTime).format('HH:mm DD/MM/YYYY'),
        checkOutTime: dayjs(checkOutTime).format('HH:mm DD/MM/YYYY'),
        actualMinutes,
        workContent,
      },
    });
  }

  // nhân viên và hr nhận mail khi lead duyệt ot ticket
  async sendOtTicketApproved(
    to: string,
    employeeName: string,
    checkInTime: Date,
    checkOutTime: Date,
    actualMinutes: number,
    workContent: string,
    mode: string,
  ): Promise<void> {
    await this.mailerService.sendMail({
      to,
      subject: 'Thông báo: Báo cáo OT đã được duyệt',
      template: 'ot-ticket-approved',
      context: {
        employeeName,
        checkInTime: dayjs(checkInTime).format('HH:mm DD/MM/YYYY'),
        checkOutTime: dayjs(checkOutTime).format('HH:mm DD/MM/YYYY'),
        actualMinutes,
        workContent,
        mode,
      },
    });
  }

  //nhân viên nhận mail khi lead từ chối ot ticket
  async sendOtTicketRejected(
    to: string,
    employeeName: string,
    checkInTime: Date,
    checkOutTime: Date,
    actualMinutes: number,
    workContent: string,
    rejectedReason: string,
  ): Promise<void> {
    await this.mailerService.sendMail({
      to,
      subject: 'Thông báo: Báo cáo OT bị từ chối',
      template: 'ot-ticket-rejected',
      context: {
        employeeName,
        checkInTime: dayjs(checkInTime).format('HH:mm DD/MM/YYYY'),
        checkOutTime: dayjs(checkOutTime).format('HH:mm DD/MM/YYYY'),
        actualMinutes,
        workContent,
        rejectedReason,
      },
    });
  }
}
