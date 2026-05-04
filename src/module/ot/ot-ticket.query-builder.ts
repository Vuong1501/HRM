import { Injectable, ForbiddenException } from '@nestjs/common';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { OtPlanEmployee } from './entities/ot-plan-employee.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from 'src/common/enums/user-role.enum';
import { OtTicketListQueryDto } from './dto/ot-ticket-list-query.dto';
import { EMPLOYEE_LIKE_ROLES } from 'src/common/constants/role-groups.constant';
import dayjs from 'dayjs';

@Injectable()
export class OtTicketQueryBuilder {
    constructor(
        @InjectRepository(OtPlanEmployee)
        private readonly otPlanEmployeeRepo: Repository<OtPlanEmployee>
    ) {}

    buildBaseQuery(): SelectQueryBuilder<OtPlanEmployee> {
        return this.otPlanEmployeeRepo
            .createQueryBuilder('ticket')
            .leftJoinAndSelect('ticket.otPlan', 'otPlan')
            .innerJoinAndSelect('ticket.employee', 'employee');
    }

    applyAuthorization(
        qb: SelectQueryBuilder<OtPlanEmployee>,
        user: User
    ): SelectQueryBuilder<OtPlanEmployee> {
        
        // Employee không được vào màn hình duyệt danh sách của người khác
        if (EMPLOYEE_LIKE_ROLES.includes(user.role)) {
            throw new ForbiddenException('Bạn không có quyền xem Danh sách phê duyệt OT Ticket');
        }
        // Admin: chỉ duyệt ticket của các Leader
        else if (user.role === UserRole.ADMIN) {
            qb.andWhere('employee.role IN (:...roles)', { roles: [UserRole.DEPARTMENT_LEAD, UserRole.HR] });
        }
        // HR, Lead: duyệt ticket của nhân viên trong cùng phòng ban
        else if (user.role === UserRole.DEPARTMENT_LEAD || user.role === UserRole.HR) {
            qb.andWhere('employee.departmentName = :dept', { dept: user.departmentName });
            // Không cho phép Lead tự duyệt ticket của mình ở màn hình này (ticket của Lead do Admin duyệt)
            qb.andWhere('employee.id != :userId', { userId: user.id });
        }

        return qb;
    }

    applyFilters(
        qb: SelectQueryBuilder<OtPlanEmployee>,
        query: OtTicketListQueryDto
    ): SelectQueryBuilder<OtPlanEmployee> {

        if (query.status) {
            qb.andWhere('ticket.status = :status', { status: query.status });
        }

        if (query.search) {
            const searchPattern = `%${query.search}%`;
            qb.andWhere('(employee.name LIKE :search OR CAST(employee.id AS CHAR) LIKE :search)', {
                search: searchPattern,
            });
        }

        if (query.fromDate && query.toDate) {
            qb.andWhere('otPlan.startTime >= :from AND otPlan.endTime <= :to', {
                from: dayjs(query.fromDate).startOf('day').toDate(),
                to: dayjs(query.toDate).endOf('day').toDate(),
            });
        }

        if (query.month && query.year) {
            qb.andWhere('MONTH(otPlan.startTime) = :month AND YEAR(otPlan.startTime) = :year', {
                month: query.month,
                year: query.year,
            });
        }

        return qb;
    }
}
