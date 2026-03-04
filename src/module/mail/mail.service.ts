import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import dayjs from 'dayjs';

@Injectable()
export class MailService {
  constructor(private readonly mailerService: MailerService) {}

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
