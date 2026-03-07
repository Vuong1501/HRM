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

@Module({
  imports: [TypeOrmModule.forFeature([OtPlan, OtPlanEmployee, User, LeaveRequest]), CaslModule, MailModule, CalendarModule],
  controllers: [OtController],
  providers: [OtService]
})
export class OtModule { }
