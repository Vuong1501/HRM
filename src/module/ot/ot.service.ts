import { Injectable, BadRequestException, ForbiddenException, NotFoundException, Logger, ConflictException } from '@nestjs/common';
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
import { SubmitOtTicketDto } from './dto/submit-ot-ticket.dto';
import { OtTimeSegmentHelper } from './helpers/ot-time-segment.helper';
import { OtCompensatoryHelper } from './helpers/ot-compensatory.helper';
import { OT_TICKET_CONSTANTS } from './ot-ticket.constants';
import { OtTimeSegment } from './entities/ot-time-segment.entity';
import { OtMode } from 'src/common/enums/ot/ot-mode.enum';
import { LeaveBalance } from '../leave/entities/leave-balance.entity';
import dayjs from 'dayjs';
import { RejectOtTicketDto } from './dto/reject-ot-ticket.dto';
import { OtPlanQueryBuilder } from './ot-plan.query-builder';
import { OtPlanListQueryDto } from './dto/ot-plan-list-query.dto';
import { UpdateOtPlanDto } from './dto/update-ot-plan.dto';
import { UpdateOtTicketTimeDto } from './dto/update-ot-ticket-time.dto';

const IT_DEPARTMENT = 'IT';
const OT_WEEKDAY_START_HOUR = 17;
const OT_WEEKDAY_START_MINUTE = 30;
const OT_WEEKDAY_MAX_HOURS = 4;
const OT_WEEKEND_MAX_HOURS = 8;

@Injectable()
export class OtService {
    private logger = new Logger(OtService.name);
    constructor(
        @InjectRepository(OtPlan)
        private otPlanRepo: Repository<OtPlan>,

        @InjectRepository(OtPlanEmployee)
        private otPlanEmployeeRepo: Repository<OtPlanEmployee>,

        @InjectRepository(User)
        private userRepo: Repository<User>,

        @InjectRepository(LeaveBalance)
        private leaveBalanceRepo: Repository<LeaveBalance>,

        @InjectRepository(OtTimeSegment)
        private otTimeSegmentRepo: Repository<OtTimeSegment>,

        private dataSource: DataSource,
        private mailService: MailService,
        private calendarService: CalendarService,
        private readonly otTimeSegmentHelper: OtTimeSegmentHelper,
        private readonly otCompensatoryHelper: OtCompensatoryHelper,
        private readonly otPlanQueryBuilder: OtPlanQueryBuilder,
    ) {}

    async getListOtPlans(user: User, query: OtPlanListQueryDto) {
        const { page = 1, limit = 10 } = query;

        let qb = this.otPlanQueryBuilder.buildBaseQuery();

        qb = this.otPlanQueryBuilder.applyAuthorization(qb, user);
        qb = this.otPlanQueryBuilder.applyFilters(qb, query, user);

        // query đếm tổng trước
        const total = await qb.getCount();

        //query lấy dữ liệu
        const dataQb = qb.clone()

        dataQb.select([
            'op.id AS id',
            'op.startTime AS startTime',
            'op.endTime AS endTime',
            'op.status AS status',
            'op.createdAt AS createdAt',
            'creator.name AS creatorName',
            'creator.departmentName AS creatorDepartment',
        ])
        .orderBy('op.createdAt', 'DESC')
        .offset((page - 1) * limit)
        .limit(limit);

        const rawData = await dataQb.getRawMany();

        const data = rawData.map((item) => {
            return {
                id: item.id,
                startTime: item.startTime,
                endTime: item.endTime,
                status: item.status,
                createdAt: item.createdAt,
                creatorName: item.creatorName,
                creatorDepartment: item.creatorDepartment,
            };
        });

        return {
            data,
            total,
            page,
            lastPage: Math.ceil(total / limit),
        };
    }

    async checkIn(user: User, otPlanEmployeeId: number) {
        const ticket = await this.otPlanEmployeeRepo.findOne({
            where: { id: otPlanEmployeeId },
            relations: ['otPlan'],
        });

        if (!ticket) throw new NotFoundException(OT_ERRORS.TICKET_NOT_FOUND);

        if (ticket.employeeId !== user.id) {
            throw new ForbiddenException(OT_ERRORS.NOT_YOUR_TICKET);
        }

        if (ticket.status !== OtPlanEmployeeStatus.PENDING) {
            throw new BadRequestException(OT_ERRORS.TICKET_NOT_INPROGRESS);
        }

        const now = dayjs();
        const otStartDate = dayjs(ticket.otPlan.startTime).startOf('day');
        const otEndDateExpired = dayjs(ticket.otPlan.endTime).add(1, 'day').endOf('day');

        if (now.isBefore(otStartDate)) {
            throw new BadRequestException(OT_ERRORS.CHECKIN_NOT_ALLOWED);
        }

        if (now.isAfter(otEndDateExpired)) {
            throw new BadRequestException(OT_ERRORS.CHECKIN_EXPIRED);
        }

        const updateResult = await this.otPlanEmployeeRepo.update(
            { 
                id: otPlanEmployeeId, 
                status: OtPlanEmployeeStatus.PENDING,
                employeeId: user.id 
            },
            { 
                checkInTime: now.toDate(),
                status: OtPlanEmployeeStatus.INPROGRESS 
            }
        );

        if (updateResult.affected === 0) {
            throw new BadRequestException(OT_ERRORS.ALREADY_CHECKED_IN);
        }

        return {
            message: 'Check-in thành công',
            data: {
                checkInTime: now.toDate(),
                status: OtPlanEmployeeStatus.INPROGRESS
            }
        };
    }

    async checkOut(user: User, otPlanEmployeeId: number) {

        const ticket = await this.otPlanEmployeeRepo.findOne({
            where: { id: otPlanEmployeeId },
            relations: ['otPlan'],
        });

        if (!ticket) throw new NotFoundException(OT_ERRORS.TICKET_NOT_FOUND);

        if (ticket.employeeId !== user.id) {
            throw new ForbiddenException(OT_ERRORS.NOT_YOUR_TICKET);
        }

        if (ticket.status !== OtPlanEmployeeStatus.INPROGRESS || !ticket.checkInTime) {
            throw new BadRequestException(OT_ERRORS.TICKET_NOT_INPROGRESS);
        }

        if (ticket.checkOutTime) {
            throw new BadRequestException(OT_ERRORS.ALREADY_CHECKED_OUT);
        }

        const now = dayjs();
        const checkInTime = dayjs(ticket.checkInTime);

        // Phải checkout sau thời gian checkin ít nhất 1 giờ
        const minCheckoutTime = checkInTime.add(OT_TICKET_CONSTANTS.MIN_CHECKOUT_AFTER_CHECKIN_HOURS, 'hour');
        if (now.isBefore(minCheckoutTime)) {
            throw new BadRequestException(OT_ERRORS.CHECKOUT_TOO_EARLY);
        }

        const maxAllowedHours = OT_TICKET_CONSTANTS.AUTO_CHECKOUT_TIMEOUT_HOURS;
        const maxCheckoutTime = checkInTime.add(maxAllowedHours, 'hour');

        if (now.isAfter(maxCheckoutTime)) {
             throw new BadRequestException(OT_ERRORS.CHECKOUT_EXPIRED);
        }

        const totalMinutes = now.diff(checkInTime, 'minute');
        
        ticket.checkOutTime = now.toDate();
        ticket.actualMinutes = totalMinutes;

        // chia ra ranh giới từng khung giờ
        const segmentsData = await this.otTimeSegmentHelper.splitIntoSegments(
            ticket.checkInTime,
            ticket.checkOutTime,
        );

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            await queryRunner.manager.save(OtPlanEmployee, ticket);

            const segmentsEntities = segmentsData.map(s => 
                queryRunner.manager.create(OtTimeSegment, {
                    otPlanEmployeeId: ticket.id,
                    ...s
                })
            );
            await queryRunner.manager.save(OtTimeSegment, segmentsEntities);

            await queryRunner.commitTransaction();

            return {
                message: 'Check-out thành công',
                data: {
                    checkOutTime: ticket.checkOutTime,
                    actualMinutes: ticket.actualMinutes,
                }
            };
        } catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    async submitOtTicket(user: User, otPlanEmployeeId: number, dto: SubmitOtTicketDto) {
        const ticket = await this.otPlanEmployeeRepo.findOne({
            where: { id: otPlanEmployeeId },
            relations: ['otPlan', 'otPlan.approver', 'otPlan.creator'],
        });

        if (!ticket) throw new NotFoundException(OT_ERRORS.TICKET_NOT_FOUND);

        if (ticket.employeeId !== user.id) {
            throw new ForbiddenException(OT_ERRORS.NOT_YOUR_TICKET);
        }

        if (ticket.status !== OtPlanEmployeeStatus.INPROGRESS || !ticket.checkOutTime) {
            throw new BadRequestException(OT_ERRORS.TICKET_NOT_INPROGRESS);
        }
        
        let compensatoryMinutes = 0;
        let otMinutes = ticket.actualMinutes;

        if (dto.mode === OtMode.COMPENSATORY) {
            if (ticket.actualMinutes < OT_TICKET_CONSTANTS.MIN_COMPENSATORY_HOURS * 60) {
                throw new BadRequestException(OT_ERRORS.COMPENSATORY_NOT_ELIGIBLE);
            }

            const segments = await this.otTimeSegmentRepo.find({
                where: { otPlanEmployeeId: ticket.id },
                order: { startTime: 'ASC' },
            });

            const result = this.otCompensatoryHelper.calculateCompensatory(segments);
            compensatoryMinutes = result.compensatoryMinutes;
            otMinutes = result.otMinutes;
        }

        const updateResult = await this.otPlanEmployeeRepo.update(
            { id: ticket.id, status: OtPlanEmployeeStatus.INPROGRESS },
            {
                mode: dto.mode,
                workContent: dto.workContent,
                note: dto.note || ticket.note,
                compensatoryMinutes,
                otMinutes,
                status: OtPlanEmployeeStatus.SUBMITTED,
            }
        );

        if (updateResult.affected === 0) {
            throw new BadRequestException(OT_ERRORS.ALREADY_SUBMITTED);
        }

        // gửi mail cho lead
        this.mailService.sendMailWithRetry(
            () => this.mailService.sendOtTicketSubmitted(
                ticket.otPlan.creator.email,
                user.name,
                user.departmentName,
                ticket.checkInTime,
                ticket.checkOutTime,
                ticket.actualMinutes,
                dto.workContent,
            ),
            'SEND_OT_NOTIFICATION_FAILED',
        ).catch(e => this.logger.error(`Lỗi gửi mail submit OT ticket cho lead ${ticket.otPlan.creator.email}`, e));

        return {
            message: 'Nộp báo cáo công việc OT thành công',
        }
    }

    async approveOtTicket(approver: User, otPlanEmployeeId: number) {
        const ticket = await this.otPlanEmployeeRepo.findOne({
            where: { id: otPlanEmployeeId },
            relations: ['otPlan','otPlan.creator', 'employee'],
        });

        if (!ticket) throw new NotFoundException(OT_ERRORS.TICKET_NOT_FOUND);
        
        const isITDepartment = ticket.otPlan.creator.departmentName === IT_DEPARTMENT;
        if(isITDepartment){
            if(approver.role !== UserRole.DEPARTMENT_LEAD || approver.departmentName !== IT_DEPARTMENT){
                throw new ForbiddenException(OT_ERRORS.NOT_YOUR_DEPARTMENT_TICKET);
            }
        } else {
            if(ticket.otPlan.creatorId !== approver.id){
                throw new ForbiddenException(OT_ERRORS.NOT_YOUR_DEPARTMENT_TICKET);
            }
        }

        if (ticket.status !== OtPlanEmployeeStatus.SUBMITTED) {
            throw new BadRequestException(OT_ERRORS.TICKET_NOT_SUBMITTED);
        }

        const hr = await this.userRepo.findOne({ where: { role: UserRole.HR } });
        if (!hr) throw new NotFoundException(OT_ERRORS.HR_NOT_FOUND);

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const updateResult = await queryRunner.manager
                .update(OtPlanEmployee, 
                    {id: otPlanEmployeeId, status: OtPlanEmployeeStatus.SUBMITTED},
                    {status: OtPlanEmployeeStatus.APPROVED}
                )
            
            if (updateResult.affected === 0) {
                throw new BadRequestException(OT_ERRORS.ALREADY_SUBMITTED);
            }

            // Nếu là nghỉ bù, cộng vào LeaveBalance
            if (ticket.mode === OtMode.COMPENSATORY && ticket.compensatoryMinutes > 0) {
                const currentYear = dayjs().year();
                const compensatoryHours = ticket.compensatoryMinutes / 60;

                await queryRunner.query(
                    `INSERT INTO leave_balances (userId, year, compensatoryBalance)
                    VALUES (?, ?, ?)
                    ON DUPLICATE KEY UPDATE
                    compensatoryBalance = compensatoryBalance + ?`,
                    [ticket.employeeId, currentYear, compensatoryHours, compensatoryHours]
                );
            }

            await queryRunner.commitTransaction();
            
            // gửi mail cho nhân viên
            this.mailService.sendMailWithRetry(
                () => this.mailService.sendOtTicketApproved(
                    ticket.employee.email,
                    ticket.employee.name,
                    ticket.checkInTime,
                    ticket.checkOutTime,
                    ticket.actualMinutes,
                    ticket.workContent,
                    ticket.mode,
                ),
                'SEND_OT_NOTIFICATION_FAILED',
            ).catch(e => this.logger.error(`Lỗi gửi mail duyệt OT ticket cho nhân viên ${ticket.employee.email}`, e));

            // gửi mail cho hr
            this.mailService.sendMailWithRetry(
                () => this.mailService.sendOtTicketApproved(
                    hr.email,
                    ticket.employee.name,
                    ticket.checkInTime,
                    ticket.checkOutTime,
                    ticket.actualMinutes,
                    ticket.workContent,
                    ticket.mode,
                ),
                'SEND_OT_NOTIFICATION_FAILED',
            ).catch(e => this.logger.error(`Lỗi gửi mail duyệt OT ticket cho HR ${hr.email}`, e));

            return { message: 'Duyệt báo cáo OT thành công' };
        } catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    async rejectOtTicket(approver: User, otPlanEmployeeId: number, dto: RejectOtTicketDto) {
        const ticket = await this.otPlanEmployeeRepo.findOne({
            where: { id: otPlanEmployeeId },
            relations: ['otPlan', 'employee'],
        });

        if (!ticket) throw new NotFoundException(OT_ERRORS.TICKET_NOT_FOUND);
        if (!dto.reason) throw new BadRequestException(OT_ERRORS.REJECT_REASON_REQUIRED);

        if (ticket.otPlan.creatorId !== approver.id) {
            throw new ForbiddenException(OT_ERRORS.NOT_YOUR_DEPARTMENT_TICKET);
        }

        if (ticket.status !== OtPlanEmployeeStatus.SUBMITTED) {
            throw new BadRequestException(OT_ERRORS.TICKET_NOT_SUBMITTED);
        }

        const updateResult = await this.otPlanEmployeeRepo.update(
            { id: otPlanEmployeeId, status: OtPlanEmployeeStatus.SUBMITTED },
            { 
                status: OtPlanEmployeeStatus.REJECTED, 
                rejectedReason: dto.reason 
            }
        );

        if (updateResult.affected === 0) {
            throw new BadRequestException(OT_ERRORS.TICKET_NOT_SUBMITTED);
        }

        // gửi mail cho nhân viên
        this.mailService.sendMailWithRetry(
            () => this.mailService.sendOtTicketRejected(
                ticket.employee.email,
                ticket.employee.name,
                ticket.checkInTime,
                ticket.checkOutTime,
                ticket.actualMinutes,
                ticket.workContent,
                dto.reason,
            ),
            'SEND_OT_REJECTED_FAILED',
        ).catch(e => this.logger.error(`Lỗi gửi mail từ chối OT ticket cho ${ticket.employee.email}`, e));

        return { message: 'Đã từ chối báo cáo OT' };
    }

    async createOtPlan(creator: User, dto: CreateOtPlanDto) {
        const startTime = dayjs(dto.startTime);
        const endTime = dayjs(dto.endTime);

        if(startTime.isAfter(endTime) || startTime.isSame(endTime)) {
            throw new BadRequestException(OT_ERRORS.INVALID_TIME_RANGE);
        }

        if (startTime.isBefore(dayjs())) {
            throw new BadRequestException(OT_ERRORS.OT_PLAN_IN_PAST);
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

        // các nhân viên phải cùng phòng với PC
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
        
        // check trùng lịch OT của từng nhân viên bằng 1 query để không bị n+1 nữa
        if (employees.length > 0) {
            const conflictOts = await this.otPlanEmployeeRepo
                .createQueryBuilder('ope')
                .innerJoin('ope.otPlan', 'op')
                .where('ope.employeeId IN (:...employeeIds)', { employeeIds: employees.map(e => e.id) })
                .andWhere('op.status IN (:...statuses)', { statuses: [OtPlanStatus.APPROVED, OtPlanStatus.PENDING] })
                // phải không được trùng cả đơn đã tạo(pending, giống như tạo đơn nghỉ)
                .andWhere('op.startTime <= :endTime AND op.endTime >= :startTime', {
                    startTime: dto.startTime,
                    endTime: dto.endTime,
                })
                .getMany();

            if (conflictOts.length > 0) {
                const conflictEmployeeIds = new Set(conflictOts.map(c => c.employeeId));
                
                const conflictNames = employees
                    .filter(e => conflictEmployeeIds.has(e.id))
                    .map(e => e.name)
                    .join(', ');

                throw new BadRequestException({
                    ...OT_ERRORS.SCHEDULE_CONFLICT_OT,
                    details: `Nhân viên ${conflictNames} có lịch OT trùng`,
                });
            }
        }

        const isPC = creator.role === UserRole.PROJECT_COORDINATOR;
        // tìm ra người duyệt
        let approver: User | null = null;
        if (isPC) {
            approver = await this.userRepo.findOne({ 
                where: { 
                    role: UserRole.DEPARTMENT_LEAD,
                    departmentName: IT_DEPARTMENT,
                } 
            });
            if (!approver) {
                throw new BadRequestException(OT_ERRORS.LEADER_IT_NOT_FOUND);
            }
        } else {
            approver = await this.userRepo.findOneBy({ role: UserRole.ADMIN });
            if (!approver) {
                throw new BadRequestException(OT_ERRORS.ADMIN_NOT_FOUND);
            }
        }

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const otPlan = queryRunner.manager.create(OtPlan, {
                creatorId: creator.id,
                startTime: startTime.toDate(),
                endTime: endTime.toDate(),
                reason: dto.reason,
                status: OtPlanStatus.PENDING,
                approverId: null,
                approvedAt: null,
            });

            const savedPlan = await queryRunner.manager.save(OtPlan, otPlan);

            const otPlanEmployees = employees.map((emp) =>
                queryRunner.manager.create(OtPlanEmployee, {
                    otPlanId: savedPlan.id,
                    employeeId: emp.id,
                    status: OtPlanEmployeeStatus.WAITING,
                }),
            );

            await queryRunner.manager.save(OtPlanEmployee, otPlanEmployees);

            await queryRunner.commitTransaction();

            // Gửi mail cho các nhân viên trong background

            this.mailService.sendMailWithRetry(
                () => this.mailService.sendOtPlanSubmitted(
                    approver.email,
                    creator.name,
                    creator.departmentName,
                    startTime.toDate(),
                    endTime.toDate(),
                    dto.reason,
                ),
                'SEND_OT_NOTIFICATION_FAILED',
            ).catch(e => console.error(`Lỗi gửi mail OT cho người duyệt ${approver.email}`, e));
            

            return {
                message: 'Tạo kế hoạch OT thành công',
                data: savedPlan
            };
        } catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    // duyệt đơn OT
    async approveOtPlan(approver: User, otPlanId: number) {

        if(approver.role !== UserRole.ADMIN) throw new ForbiddenException(OT_ERRORS.ONLY_ADMIN_APPROVE);

        const otPlan = await this.otPlanRepo.findOne({
            where: { id: otPlanId },
            relations: ['employees', 'employees.employee'],
        });

        if (!otPlan) throw new NotFoundException(OT_ERRORS.OT_PLAN_NOT_FOUND);

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            // atomic update
            const updateResult = await queryRunner.manager.update(
                OtPlan,
                {id: otPlanId, status: OtPlanStatus.PENDING},
                {
                    status: OtPlanStatus.APPROVED,
                    approverId: approver.id,
                    approvedAt: dayjs().toDate(),
                }
            );

            if(updateResult.affected === 0) {
                throw new BadRequestException(OT_ERRORS.OT_PLAN_NOT_PENDING);
            }

            // update atomic bảng con
            await queryRunner.manager.update(OtPlanEmployee,
                {otPlanId: otPlanId},
                {status: OtPlanEmployeeStatus.PENDING}
            );

            await queryRunner.commitTransaction();
            // Gửi mail cho từng nhân viên trong background
            Promise.all(
                otPlan.employees.map((emp) =>
                    this.mailService.sendMailWithRetry(
                        () => this.mailService.sendOtPlanApproved(
                            emp.employee.email,
                            emp.employee.name,
                            otPlan.startTime,
                            otPlan.endTime,
                            otPlan.reason,
                        ),
                        'SEND_OT_NOTIFICATION_FAILED',
                    ).catch(e => console.error(`Lỗi gửi mail OT được duyệt cho ${emp.employee.email}`, e))
                ),
            );
            return { message: 'Duyệt kế hoạch OT thành công' };
        } catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    // từ chối đơn OT
    async rejectOtPlan(approver: User, otPlanId: number, rejectedReason: string) {
        if(approver.role !== UserRole.ADMIN) {
            throw new ForbiddenException(OT_ERRORS.ONLY_ADMIN_REJECT);
        }

        if(!rejectedReason || rejectedReason.trim() === '') {
            throw new BadRequestException(OT_ERRORS.REJECT_REASON_REQUIRED);
        }

        const otPlan = await this.otPlanRepo.findOne({
            where: { id: otPlanId },
            relations: ['creator'],
        });

        if (!otPlan) throw new NotFoundException(OT_ERRORS.OT_PLAN_NOT_FOUND);

        // atomic update Bảng Cha
        const updateResult = await this.otPlanRepo.update(
            { id: otPlanId, status: OtPlanStatus.PENDING },
            {
                status: OtPlanStatus.REJECTED,
                approverId: approver.id,
                rejectedReason: rejectedReason,
                approvedAt: null,
            }
        );

        if(updateResult.affected === 0) {
            throw new BadRequestException(OT_ERRORS.OT_PLAN_NOT_PENDING);
        }

        this.mailService.sendMailWithRetry(
            () => this.mailService.sendOtPlanRejected(
                otPlan.creator.email,
                otPlan.creator.name,
                otPlan.startTime,
                otPlan.endTime,
                rejectedReason,
            ),
            'SEND_OT_REJECTED_FAILED',
        ).catch(e => console.error(`Lỗi gửi mail OT bị từ chối cho quản lý ${otPlan.creator.email}`, e));

        return { message: 'Từ chối kế hoạch OT thành công' };
    }

    async updateOtPlan(user: User, otPlanId: number, dto: UpdateOtPlanDto) {
        const otPlan = await this.otPlanRepo.findOne({
            where: { id: otPlanId },
            relations: ['employees', 'employees.employee'],
        });

        if(!otPlan) throw new NotFoundException(OT_ERRORS.OT_PLAN_NOT_FOUND);

        if (otPlan.version !== dto.version) {
            throw new ConflictException(OT_ERRORS.OT_PLAN_ALREADY_UPDATED);
        }
        if (otPlan.status !== OtPlanStatus.PENDING) {
            throw new ConflictException(OT_ERRORS.OT_PLAN_NOT_PENDING);
        }

        //check quyền
        const isITDepartment = user.departmentName === IT_DEPARTMENT;
        const isPC = user.role === UserRole.PROJECT_COORDINATOR;
        const isLead = user.role === UserRole.DEPARTMENT_LEAD;
        const isAdmin = user.role === UserRole.ADMIN;

        if (!isAdmin && !isLead && !isPC && !isITDepartment) {
            throw new ForbiddenException(OT_ERRORS.ONLY_ADMIN_OR_LEAD_IT_APPROVE);
        }

        const canUpdateFull = (isPC && isITDepartment) || (isLead && !isITDepartment);
        const canUpdatePartial = isAdmin || (isLead && isITDepartment);

        if (!canUpdateFull && !canUpdatePartial) {
            throw new ForbiddenException(OT_ERRORS.NO_PERMISSION_UPDATE);
        }

        // check quyền để tương tác với đơn
        if (canUpdateFull && otPlan.creatorId !== user.id) {
            throw new ForbiddenException(OT_ERRORS.NOT_YOUR_OT_PLAN);
        }

        //validate thời gian
        const newStartTime = dto.startTime ? dayjs(dto.startTime) : dayjs(otPlan.startTime);
        const newEndTime = dto.endTime ? dayjs(dto.endTime) : dayjs(otPlan.endTime);

        if (newStartTime.isAfter(newEndTime)|| newStartTime.isSame(newEndTime)) {
            throw new BadRequestException(OT_ERRORS.INVALID_TIME_RANGE);
        }

        // Check ngày thường/cuối tuần
        if (dto.startTime || dto.endTime) {
            const isWeekendOrHoliday = await this.calendarService.isWeekendOrHoliday(newStartTime);
            const durationHours = newEndTime.diff(newStartTime, 'hour', true);

            if (!isWeekendOrHoliday) {
                const isAfter1730 =
                    newStartTime.hour() > OT_WEEKDAY_START_HOUR ||
                    (newStartTime.hour() === OT_WEEKDAY_START_HOUR && newStartTime.minute() >= OT_WEEKDAY_START_MINUTE);

                if (!isAfter1730) throw new BadRequestException(OT_ERRORS.WEEKDAY_OT_MUST_START_AFTER_1730);
                if (durationHours > OT_WEEKDAY_MAX_HOURS) throw new BadRequestException(OT_ERRORS.WEEKDAY_OT_MAX_4_HOURS);
            } else {
                if (durationHours > OT_WEEKEND_MAX_HOURS) throw new BadRequestException(OT_ERRORS.WEEKEND_OT_MAX_8_HOURS);
            }
        }

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            if(canUpdateFull) {
                const updateData: Partial<OtPlan> = {};
                if (dto.startTime) updateData.startTime = dayjs(dto.startTime).toDate();
                if (dto.endTime) updateData.endTime = dayjs(dto.endTime).toDate();
                if (dto.reason) updateData.reason = dto.reason; 

                const updateResult = await queryRunner.manager.update(OtPlan,
                    {
                        id: otPlanId,
                        status: OtPlanStatus.PENDING,
                        version: dto.version,
                    },
                    {
                        ...updateData,
                        status: OtPlanStatus.PENDING,
                        version: dto.version + 1,
                    }
                );

                if (updateResult.affected === 0) {
                    throw new ConflictException(OT_ERRORS.OT_PLAN_ALREADY_APPROVED);
                }

                // update lại nhân viên nếu có thay đổi
                if(dto.employeeIds && dto.employeeIds.length > 0) {
                    const employees = await this.userRepo.find({
                        where: dto.employeeIds.map(id => ({ id })),
                    });

                    if(employees.length !== dto.employeeIds.length) {
                        throw new NotFoundException(OT_ERRORS.EMPLOYEE_NOT_FOUND);
                    }

                    const invalidEmployees = employees.filter(
                        emp => emp.departmentName !== user.departmentName
                    );
                    if (invalidEmployees.length > 0) {
                        throw new ForbiddenException(OT_ERRORS.ONLY_OWN_DEPARTMENT);
                    }

                    // bỏ nhân viên cũ và thêm nhân viên mới
                    await queryRunner.manager.delete(OtPlanEmployee, {
                        otPlanId: otPlanId,
                    });

                    const newEmployees = employees.map(emp =>
                        queryRunner.manager.create(OtPlanEmployee, {
                            otPlanId,
                            employeeId: emp.id,
                            status: OtPlanEmployeeStatus.WAITING,
                        })
                    );
                    await queryRunner.manager.insert(OtPlanEmployee, newEmployees);
                }
                await queryRunner.commitTransaction();
                return { message: 'Cập nhật kế hoạch OT thành công' };
            } else {
                // lead IT hoặc admin cập nhật thì nó thành updated

                if (dto.employeeIds && dto.employeeIds.length > 0) {
                    throw new ForbiddenException(OT_ERRORS.CANNOT_UPDATE_EMPLOYEES);
                }
                const updateData: Partial<OtPlan> = {};
                if (dto.startTime) updateData.startTime = dayjs(dto.startTime).toDate();
                if (dto.endTime) updateData.endTime = dayjs(dto.endTime).toDate();
                if (dto.reason) updateData.reason = dto.reason;

                // update atomic
                const updateResult = await queryRunner.manager.update(OtPlan, 
                    { id: otPlanId, status: OtPlanStatus.PENDING, version: dto.version },
                    {
                        ...updateData,
                        status: OtPlanStatus.UPDATED,
                        approverId: user.id,
                        approvedAt: dayjs().toDate(),
                        version: dto.version + 1,
                    }
                );

                if (updateResult.affected === 0) {
                    throw new ConflictException(OT_ERRORS.OT_PLAN_ALREADY_APPROVED);
                }

                await queryRunner.manager.update(OtPlanEmployee,
                    { otPlanId },
                    { status: OtPlanEmployeeStatus.PENDING }
                );
                await queryRunner.commitTransaction();
                const mailStartTime = updateData.startTime ?? otPlan.startTime;
                const mailEndTime = updateData.endTime ?? otPlan.endTime;
                const mailReason = updateData.reason ?? otPlan.reason;
                Promise.all(
                otPlan.employees.map((emp) =>
                    this.mailService.sendMailWithRetry(
                        () => this.mailService.sendOtPlanApproved(
                            emp.employee.email,
                            emp.employee.name,
                            mailStartTime,
                            mailEndTime,
                            mailReason,
                        ),
                        'SEND_OT_NOTIFICATION_FAILED',
                    ).catch(e => console.error(`Lỗi gửi mail OT được duyệt cho ${emp.employee.email}`, e))
                ),
            );
                return { message: 'Cập nhật kế hoạch OT thành công' };
            }
        } catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    async getOtTicketDetail(user: User, otPlanEmployeeId: number){
        const otPlanEmployee = await this.otPlanEmployeeRepo.findOne({
            where: {id: otPlanEmployeeId, employeeId: user.id},
            relations: ['otPlan'],
            select: {
                otPlan: {
                    id: true,
                    startTime: true,
                    endTime: true,
                    reason: true,
                    status: true,
                },
                id: true,
                status: true,
                checkInTime: true,
                checkOutTime: true,
                workContent: true,
                actualMinutes: true,
                mode: true,
                rejectedReason: true,
            },
        });

        if(!otPlanEmployee) throw new NotFoundException(OT_ERRORS.OT_PLAN_NOT_FOUND);

        return {
            message: 'Lấy chi tiết đơn OT thành công',
            data: otPlanEmployee,
        };
    }

    async updateTicketTimeByLead(user: User, ticketId: number, dto: UpdateOtTicketTimeDto) {

        const ticket = await this.otPlanEmployeeRepo.findOne({
            where: { id: ticketId },
            relations: ['otPlan','otPlan.creator', 'employee'],
        });

        if (!ticket) {
            throw new NotFoundException(OT_ERRORS.TICKET_NOT_FOUND);
        }

        if(user.role !== UserRole.DEPARTMENT_LEAD){
            throw new ForbiddenException(OT_ERRORS.NOT_YOUR_TICKET);
        }
        const isITDepartment = ticket.otPlan.creator.departmentName === IT_DEPARTMENT;

        if (isITDepartment) {
            if (user.departmentName !== IT_DEPARTMENT) {
                throw new ForbiddenException(OT_ERRORS.NOT_YOUR_DEPARTMENT_TICKET);
            }
        } else {
            if (ticket.otPlan.creatorId !== user.id) {
                throw new ForbiddenException(OT_ERRORS.NOT_YOUR_DEPARTMENT_TICKET);
            }
        }

        if (ticket.status !== OtPlanEmployeeStatus.SUBMITTED) {
            throw new BadRequestException(OT_ERRORS.TICKET_NOT_SUBMITTED);
        }

        const updatedCheckIn = dto.updatedCheckInTime
            ? dayjs(dto.updatedCheckInTime)
            : dayjs(ticket.checkInTime);

        const updatedCheckOut = dto.updatedCheckOutTime
            ? dayjs(dto.updatedCheckOutTime)
            : dayjs(ticket.checkOutTime);

        if (updatedCheckIn.isAfter(updatedCheckOut)) {
            throw new BadRequestException(OT_ERRORS.INVALID_OT_TIME);
        }

        const minUpdateCheckoutTime = updatedCheckIn.add(OT_TICKET_CONSTANTS.MIN_CHECKOUT_AFTER_CHECKIN_HOURS, 'hour');
        if (updatedCheckOut.isBefore(minUpdateCheckoutTime)) {
            throw new BadRequestException(OT_ERRORS.CHECKOUT_TOO_EARLY);
        };

        const hr = await this.userRepo.findOne({ where: { role: UserRole.HR } });
        if (!hr) throw new NotFoundException(OT_ERRORS.HR_NOT_FOUND);

        const totalMinutes = updatedCheckOut.diff(updatedCheckIn, 'minute');

        const newSegmentsData = await this.otTimeSegmentHelper.splitIntoSegments(
            updatedCheckIn.toDate(),
            updatedCheckOut.toDate()
        );

        let compensatoryMinutes = 0;
        let otMinutes = totalMinutes;
        let newMode = ticket.mode;
        const modeChanged = ticket.mode === OtMode.COMPENSATORY
            && totalMinutes < OT_TICKET_CONSTANTS.MIN_COMPENSATORY_HOURS * 60;

        if(ticket.mode === OtMode.COMPENSATORY){
            if (totalMinutes < OT_TICKET_CONSTANTS.MIN_COMPENSATORY_HOURS * 60) {
                // không đủ tiếng thì tự chuyển sang ot thay vì comp
                newMode = OtMode.OT;
                compensatoryMinutes = 0;
                otMinutes = totalMinutes;
            }else{
                const tempSegments = newSegmentsData.map(seg =>
                    this.otPlanEmployeeRepo.manager.create(OtTimeSegment, {
                        ...seg,
                        otPlanEmployeeId: ticketId,
                    })
                );
                const result = this.otCompensatoryHelper.calculateCompensatory(tempSegments);
                compensatoryMinutes = result.compensatoryMinutes;
                otMinutes = result.otMinutes;
            }
        }

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction(); 

        try {

            const updateResult = await queryRunner.manager.update(OtPlanEmployee,
                { id: ticketId, status: OtPlanEmployeeStatus.SUBMITTED },
                {
                    checkInAfterUpdate: updatedCheckIn.toDate(),
                    checkOutAfterUpdate: updatedCheckOut.toDate(),
                    updateReason: dto.reason,
                    actualMinutes: totalMinutes,
                    compensatoryMinutes,
                    otMinutes,
                    mode: newMode,
                    status: OtPlanEmployeeStatus.UPDATED,
                }
            );
            if (updateResult.affected === 0) {
                throw new ConflictException(OT_ERRORS.TICKET_ALREADY_PROCESSED);
            }
            // xóa cũ, thêm segment 
            await queryRunner.manager.delete(OtTimeSegment, { otPlanEmployeeId: ticketId });
            const newSegmentsEntity = newSegmentsData.map(seg => queryRunner.manager.create(OtTimeSegment, {
                ...seg,
                otPlanEmployeeId: ticketId
            }));

            await queryRunner.manager.save(OtTimeSegment, newSegmentsEntity);
            await queryRunner.commitTransaction();

            // gửi mail
            this.mailService.sendMailWithRetry(
                () => this.mailService.sendOtTicketUpdatedByLead(
                    ticket.employee.email,
                    ticket.employee.name,
                    updatedCheckIn.toDate(),
                    updatedCheckOut.toDate(),
                    totalMinutes,
                    ticket.workContent,
                    newMode,
                    dto.reason,
                    modeChanged,
                ),
                'SEND_OT_NOTIFICATION_FAILED',
            ).catch(e => this.logger.error(`Lỗi gửi mail cập nhật OT ticket cho nhân viên ${ticket.employee.email}`, e));

            this.mailService.sendMailWithRetry(
                () => this.mailService.sendOtTicketUpdatedByLead(
                    hr.email,
                    ticket.employee.name,
                    updatedCheckIn.toDate(),
                    updatedCheckOut.toDate(),
                    totalMinutes,
                    ticket.workContent,
                    newMode,
                    dto.reason,
                    modeChanged,
                ),
                'SEND_OT_NOTIFICATION_FAILED',
            ).catch(e => this.logger.error(`Lỗi gửi mail cập nhật OT ticket cho HR ${hr.email}`, e));
            
            return {
                message: 'Cập nhật thời gian OT thành công',
                ...(newMode !== ticket.mode && {
                    warning: `Mode đã tự động chuyển từ COMPENSATORY sang OT do không đủ ${OT_TICKET_CONSTANTS.MIN_COMPENSATORY_HOURS} tiếng`,
                }),
            };

        } catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        } finally {
            await queryRunner.release();
        }
    }
}
