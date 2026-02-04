import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: Transporter;

  constructor() {
    const user = process.env.ZOHO_EMAIL;
    const pass = process.env.ZOHO_APP_PASSWORD;

    if (!user || !pass) {
      throw new Error('Mail env missing');
    }

    this.transporter = nodemailer.createTransport({
      host: 'smtp.zoho.com',
      port: 465,
      secure: true,
      auth: { user, pass },
    }) as Transporter;
  }

  async sendInvite(email: string, link: string): Promise<void> {
    await this.transporter.sendMail({
      from: `"HR System" <${process.env.ZOHO_EMAIL}>`,
      to: email,
      subject: 'Invitation to HR System',
      html: `
        <h3>You are invited</h3>
        <p>Click below:</p>
        <a href="${link}">Accept invitation</a>
      `,
    });
  }
}
