import { Injectable } from '@nestjs/common';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { LeaveRequest } from './entities/leave-request.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from 'src/common/enums/user-role.enum';
import { LeaveRequestStatus } from 'src/common/enums/leave-request-status.enum';
import { LeaveListQueryDto } from './dto/leave-list-query.dto';
import { EMPLOYEE_LIKE_ROLES } from 'src/common/constants/role-groups.constant';

@Injectable()
export class LeaveRequestQueryBuilder {
    constructor(
        @InjectRepository(LeaveRequest)
        private readonly leaveRequestRepo: Repository<LeaveRequest>
    ){}

    buildBaseQuery(): SelectQueryBuilder<LeaveRequest>{
        return this.leaveRequestRepo
            .createQueryBuilder('lr')
            .leftJoinAndSelect('lr.user', 'user')
            .leftJoin('lr.approver', 'approver');
    }

    applyAuthorization(
        qb: SelectQueryBuilder<LeaveRequest>,
        user: User,
        isSelf: boolean = false
    ): SelectQueryBuilder<LeaveRequest> {

        if (isSelf) {
            qb.andWhere('user.id = :id', { id: user.id });
            return qb;
        }

        if (user.role === UserRole.DEPARTMENT_LEAD) {
            qb.andWhere('user.departmentName = :dept', {
                dept: user.departmentName,
            });
            // Lead không tự duyệt đơn của mình
            qb.andWhere('user.id != :id', { id: user.id });
        }

        if (user.role === UserRole.HR) {
            // HR xem đơn nhân viên cùng phòng ban, trừ đơn của chính mình
            qb.andWhere('user.departmentName = :dept', {
                dept: user.departmentName,
            });
            qb.andWhere('user.id != :id', { id: user.id });
        }

        if (user.role === UserRole.ADMIN) {
            // Admin thấy đơn của Lead và HR
            qb.andWhere('user.role IN (:...roles)', {
                roles: [UserRole.DEPARTMENT_LEAD, UserRole.HR],
            });
        }

        return qb;
    }

    applyFilters(
        qb: SelectQueryBuilder<LeaveRequest>,
        query: LeaveListQueryDto,
    ): SelectQueryBuilder<LeaveRequest>{

        if (query.status) {
            qb.andWhere('lr.status = :status', { status: query.status });
        }

        if (query.search) {
            qb.andWhere('user.name LIKE :search', {
                search: `%${query.search}%`,
            });
        }

        if (query.department) {
            qb.andWhere('user.departmentName = :dept', {
                dept: query.department,
            });
        }

        if (query.fromDate && query.toDate) {
            qb.andWhere('lr.startDate BETWEEN :from AND :to', {
                from: query.fromDate,
                to: query.toDate,
            });
        }

        if (query.month && query.year) {
            qb.andWhere('MONTH(lr.startDate) = :month', {
                month: query.month,
            });
            qb.andWhere('YEAR(lr.startDate) = :year', {
                year: query.year,
            });
        }

        return qb;
    }

    // Dành riêng cho màn hình report của HR: chỉ lấy đơn đã APPROVED
    applyHRReportAuthorization(
        qb: SelectQueryBuilder<LeaveRequest>,
        user: User,
    ): SelectQueryBuilder<LeaveRequest> {
        qb.andWhere('lr.status = :status', {
            status: LeaveRequestStatus.APPROVED,
        });
        // HR chỉ xem trong phòng ban của mình
        qb.andWhere('user.departmentName = :dept', {
            dept: user.departmentName,
        });
        return qb;
    }
}