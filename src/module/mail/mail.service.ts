import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import dayjs from 'dayjs';
import { MAIL_ERRORS } from './mail.errors';
import { Logger } from '@nestjs/common';

const MAIL_MAX_RETRIES = 3;
const MAIL_RETRY_DELAY_MS = 2000;

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  constructor(
    private readonly mailerService: MailerService,
  ) {}

  async sendMailWithRetry(
    sendFn: () => Promise<void>,
    errorCode: keyof typeof MAIL_ERRORS,
    maxRetries: number = MAIL_MAX_RETRIES,
  ): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await sendFn();
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
        throw new InternalServerErrorException(MAIL_ERRORS[errorCode]);
      }

      const delayMs = MAIL_RETRY_DELAY_MS * attempt;
      await new Promise(resolve => setTimeout(resolve, delayMs));
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
}
