import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { OtPlan } from './entities/ot-plan.entity';
import { OtPlanEmployee } from './entities/ot-plan-employee.entity';
import { User } from '../users/entities/user.entity';
import { CreateOtPlanDto } from './dto/create-ot-plan.dto';
import { OtPlanStatus } from 'src/common/enums/ot/ot-status.enum';
import { OtPlanEmployeeStatus } from 'src/common/enums/ot/ot-employee-status.enum';
import { LeaveRequestStatus } from 'src/common/enums/leave-request-status.enum';
import { UserRole } from 'src/common/enums/user-role.enum';
import { OT_ERRORS } from './ot.errors';
import { MailService } from '../mail/mail.service';
import dayjs from 'dayjs';


const IT_DEPARTMENT = 'IT';
const OT_WEEKDAY_START_HOUR = 17;
const OT_WEEKDAY_START_MINUTE = 30;
const OT_WEEKDAY_MAX_HOURS = 4;
const OT_WEEKEND_MAX_HOURS = 8;

@Injectable()
export class OtService {
    constructor(
        @InjectRepository(OtPlan)
        private otPlanRepo: Repository<OtPlan>,

        @InjectRepository(OtPlanEmployee)
        private otPlanEmployeeRepo: Repository<OtPlanEmployee>,

        @InjectRepository(User)
        private userRepo: Repository<User>,

        private dataSource: DataSource,
        private mailService: MailService,
    ) {}

    async createOtPlan(creator: User, dto: CreateOtPlanDto) {
        const startTime = dayjs(dto.startTime);
        const endTime = dayjs(dto.endTime);

        if(startTime.isAfter(endTime) || startTime.isSame(endTime)) {
            throw new BadRequestException(OT_ERRORS.INVALID_TIME_RANGE);
        }

        const employees = await this.userRepo.find({
            where: dto.employeeIds.map(id => ({ id }))
        })

        if(employees.length !== dto.employeeIds.length) {
            throw new BadRequestException(OT_ERRORS.EMPLOYEE_NOT_FOUND);
        }

        const invalidEmployees = employees.filter((emp) => 
            emp.departmentName !== creator.departmentName
        )

        if (invalidEmployees.length > 0) {
            throw new ForbiddenException(OT_ERRORS.ONLY_OWN_DEPARTMENT);
        }
        

    }

}
