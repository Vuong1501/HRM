import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeaveRequest } from './entities/leave-request.entity';
import { LeaveBalance } from './entities/leave-balance.entity';
import { LeaveService } from './leave.service';
import { LeaveController } from './leave.controller';
import { User } from '../users/entities/user.entity';
import { CaslModule } from '../casl/casl.module';
import { LeaveAccrualService } from './leave-accrual.service';
import { LeaveSeedService } from './leave-seed.service';

import { LeaveConfig } from './entities/leave-config.entity';
import { MailModule } from '../mail/mail.module';
import { LeaveAttachment } from './entities/leave_attachments';

@Module({
  imports: [TypeOrmModule.forFeature([LeaveRequest, LeaveBalance, User, LeaveConfig, LeaveAttachment]), CaslModule, MailModule],
  controllers: [LeaveController],
  providers: [LeaveService, LeaveAccrualService, LeaveSeedService],
  exports: [LeaveService, LeaveAccrualService],
})
export class LeaveModule {}

