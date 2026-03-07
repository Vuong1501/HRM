import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { OtPlan } from './entities/ot-plan.entity';
import { OtPlanEmployee } from './entities/ot-plan-employee.entity';
import { User } from '../users/entities/user.entity';
import { LeaveRequest } from '../leave/entities/leave-request.entity';
import { CreateOtPlanDto } from './dto/create-ot-plan.dto';
import { OtPlanStatus } from 'src/common/enums/ot/ot-status.enum';
import { OtPlanEmployeeStatus } from 'src/common/enums/ot/ot-employee-status.enum';
import { LeaveRequestStatus } from 'src/common/enums/leave-request-status.enum';
import { UserRole } from 'src/common/enums/user-role.enum';
import { OT_ERRORS } from './ot.errors';
import { MailService } from '../mail/mail.service';
import dayjs from 'dayjs';


const IT_DEPARTMENT = 'IT';

@Injectable()
export class OtService {
    constructor(
        @InjectRepository(OtPlan)
        private otPlanRepo: Repository<OtPlan>,

        @InjectRepository(OtPlanEmployee)
        private otPlanEmployeeRepo: Repository<OtPlanEmployee>,

        @InjectRepository(User)
        private userRepo: Repository<User>,

        @InjectRepository(LeaveRequest)
        private leaveRequestRepo: Repository<LeaveRequest>,

        private dataSource: DataSource,
        private mailService: MailService,
    ) {}

    async createOtPlan(creator: User, dto: CreateOtPlanDto) {
        const startTime = dayjs(dto.startTime);
        const endTime = dayjs(dto.endTime);
    }

}
