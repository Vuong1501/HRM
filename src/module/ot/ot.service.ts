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
import { CalendarService } from '../calendar/calendar.service';
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
        private calendarService: CalendarService,
    ) {}

    async createOtPlan(creator: User, dto: CreateOtPlanDto) {
        const startTime = dayjs(dto.startTime);
        const endTime = dayjs(dto.endTime);

        if(startTime.isAfter(endTime) || startTime.isSame(endTime)) {
            throw new BadRequestException(OT_ERRORS.INVALID_TIME_RANGE);
        }

        // check ngày thường hay cuối tuần hoặc lễ
        const isWeekendOrHoliday = await this.calendarService.isWeekendOrHoliday(startTime);
        const durationHours = endTime.diff(startTime, 'hour', true);

        if(!isWeekendOrHoliday) {
            // ngày thường start time phải >= 17:30
            const isAfter1730 = 
                startTime.hour() > OT_WEEKDAY_START_HOUR ||
                (startTime.hour() === OT_WEEKDAY_START_HOUR && startTime.minute() >= OT_WEEKDAY_START_MINUTE);
            
            if(!isAfter1730) {
                throw new BadRequestException(OT_ERRORS.WEEKDAY_OT_MUST_START_AFTER_1730);
            }

            // trong tuần max chỉ 4 tiếng
            if (durationHours > OT_WEEKDAY_MAX_HOURS) {
                throw new BadRequestException(OT_ERRORS.WEEKDAY_OT_MAX_4_HOURS);
            }
        } else {
            // cuối tuần hoặc lễ max 8 tiếng
            if (durationHours > OT_WEEKEND_MAX_HOURS) {
                throw new BadRequestException(OT_ERRORS.WEEKEND_OT_MAX_8_HOURS);
            }
        }

        // các nhân viên phải cùng phòng với lead
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
        
        // check trùng lịch OT của từng nhân viên trong đơn ot đang tạo
        for(const employee of employees){
            const conflictOt = await this.otPlanEmployeeRepo
            .createQueryBuilder('ope')
            .leftJoin('ope.otPlan','op')
            .where('ope.employeeId = :employeeId', { employeeId: employee.id })
            .andWhere('op.status IN (:...statuses)', { statuses: [OtPlanStatus.APPROVED, OtPlanStatus.PENDING] })
            // phải không được trùng cả đơn đã tạo(pending, giống như tạo đơn nghỉ)
            .andWhere('op.startTime <= :endTime AND op.endTime >= :startTime', {
                startTime: dto.startTime,
                endTime: dto.endTime,
            })
            .getOne();

            if(conflictOt) {
               throw new BadRequestException({
                    ...OT_ERRORS.SCHEDULE_CONFLICT_OT,
                    details: `Nhân viên ${employee.name} có lịch OT trùng`,
                });
            }
        }

        // phòng IT tự động approve luôn khi tạo đơn
        const isItDepartment = creator.departmentName === IT_DEPARTMENT;

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const otPlan = queryRunner.manager.create(OtPlan, {
                creatorId: creator.id,
                startTime: startTime.toDate(),
                endTime: endTime.toDate(),
                reason: dto.reason,
                status: isItDepartment ? OtPlanStatus.APPROVED : OtPlanStatus.PENDING,
                approverId: isItDepartment ? creator.id : null,
                approvedAt: isItDepartment ? dayjs().toDate() : null,
            });

            const savedPlan = await queryRunner.manager.save(OtPlan, otPlan);

            const otPlanEmployees = employees.map((emp) =>
                queryRunner.manager.create(OtPlanEmployee, {
                    otPlanId: savedPlan.id,
                    employeeId: emp.id,
                    status: OtPlanEmployeeStatus.PENDING,
                }),
            );

            await queryRunner.manager.save(OtPlanEmployee, otPlanEmployees);

            // cần thêm đoạn gửi mail cho các nhân viên

            await queryRunner.commitTransaction();
            return savedPlan;
        } catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

}
