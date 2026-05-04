import { Module } from '@nestjs/common';
import { OtController } from './ot.controller';
import { OtService } from './ot.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OtPlan } from './entities/ot-plan.entity';
import { OtPlanEmployee } from './entities/ot-plan-employee.entity';
import { User } from '../users/entities/user.entity';
import { LeaveRequest } from '../leave/entities/leave-request.entity';
import { CaslModule } from '../casl/casl.module';
import { MailModule } from '../mail/mail.module';
import { CalendarModule } from '../calendar/calendar.module';
import { OtTimeSegment } from './entities/ot-time-segment.entity';
import { OtTimeSegmentHelper } from './helpers/ot-time-segment.helper';
import { OtCompensatoryHelper } from './helpers/ot-compensatory.helper';
import { OtTicketSweeperService } from './ot-ticket-sweeper.service';
import { LeaveBalance } from '../leave/entities/leave-balance.entity';
import { OtPlanQueryBuilder } from './ot-plan.query-builder';
import { OtTicketQueryBuilder } from './ot-ticket.query-builder';

@Module({
  imports: [TypeOrmModule.forFeature([OtPlan, OtPlanEmployee, OtTimeSegment, User, LeaveRequest, LeaveBalance]), CaslModule, MailModule, CalendarModule],
  controllers: [OtController],
  providers: [OtService, OtTimeSegmentHelper, OtCompensatoryHelper, OtTicketSweeperService, OtPlanQueryBuilder, OtTicketQueryBuilder]
})
export class OtModule { }
