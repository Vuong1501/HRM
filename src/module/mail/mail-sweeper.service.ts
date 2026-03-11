import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, In, Repository } from 'typeorm';
import { OutboxMail } from './entities/outbox-mail.entity';
import { OutboxStatus } from '../../common/enums/outbox-status.enum';
import { MailService } from './mail.service';

const CRON_MAX_RETRIES = 3;
const CRON_INTERVAL = '*/15 * * * *';
const PENDING_TIMEOUT_MS = 5 * 60 * 1000; // 5 phút

@Injectable()
export class MailSweeperService {
  private readonly logger = new Logger(MailSweeperService.name);

  constructor(
    @InjectRepository(OutboxMail)
    private readonly outboxRepo: Repository<OutboxMail>,
    private readonly mailService: MailService,
  ) {}

  @Cron(CRON_INTERVAL)
  async handleCron() {
    this.logger.debug('[OUTBOX_SWEEP_START]');

    const pendingCutoff = new Date(Date.now() - PENDING_TIMEOUT_MS);

    const stuckMails = await this.outboxRepo
      .createQueryBuilder('outbox')
      .where('outbox.retryCount < :maxRetries', { maxRetries: CRON_MAX_RETRIES })
      .andWhere(
        '(outbox.status = :failed OR (outbox.status = :pending AND outbox.createdAt < :cutoff))',
        {
          failed: OutboxStatus.FAILED,
          pending: OutboxStatus.PENDING,
          cutoff: pendingCutoff,
        },
      )
      .getMany();

    if (stuckMails.length === 0) {
      this.logger.debug('[OUTBOX_SWEEP_EMPTY]');
      return;
    }

    this.logger.debug(`[OUTBOX_SWEEP_FOUND] count=${stuckMails.length}`);

    for (const mail of stuckMails) {
      mail.retryCount += 1;
      
      try {
        const context = JSON.parse(mail.contextJson);

        if (mail.template === 'invite') {
          await this.mailService.sendMailWithRetry(
            () => this.mailService.sendInvite(mail.recipient, context.link),
            'SEND_INVITE_FAILED',
            mail.id,
            true 
          );
        }

        await this.outboxRepo.update(mail.id, { retryCount: mail.retryCount });
        this.logger.log(`[OUTBOX_RETRY_SUCCESS] id=${mail.id}, recipient=${mail.recipient}`);
      } catch (error) {
        const newStatus = mail.retryCount >= CRON_MAX_RETRIES ? OutboxStatus.FATAL_FAILED : OutboxStatus.FAILED;
        
        await this.outboxRepo.update(mail.id, { 
          retryCount: mail.retryCount,
          status: newStatus 
        });
        
        this.logger.error(`[OUTBOX_RETRY_FAILED] id=${mail.id}, attempt=${mail.retryCount}/${CRON_MAX_RETRIES}, recipient=${mail.recipient}`, error instanceof Error ? error.message : '');
      }
    }
  }
}
