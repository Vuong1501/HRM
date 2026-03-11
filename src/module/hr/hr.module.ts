import { Module } from '@nestjs/common';
import { HrService } from './hr.service';
import { HrController } from './hr.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { MailModule } from '../mail/mail.module';
import { OutboxMail } from '../mail/entities/outbox-mail.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, OutboxMail]), MailModule],
  controllers: [HrController],
  providers: [HrService],
})
export class HrModule {}
