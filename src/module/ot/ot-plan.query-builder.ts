import { Injectable, ForbiddenException } from '@nestjs/common';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { OtPlan } from './entities/ot-plan.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from 'src/common/enums/user-role.enum';
import { OtPlanListQueryDto } from './dto/ot-plan-list-query.dto';
import dayjs from 'dayjs';

@Injectable()
export class OtPlanQueryBuilder {
    constructor(
        @InjectRepository(OtPlan)
        private readonly otPlanRepo: Repository<OtPlan>
    ) {}

    buildBaseQuery(): SelectQueryBuilder<OtPlan> {
        return this.otPlanRepo
            .createQueryBuilder('op')
            .innerJoinAndSelect('op.creator', 'creator');
    }

    applyAuthorization(
        qb: SelectQueryBuilder<OtPlan>,
        user: User
    ): SelectQueryBuilder<OtPlan> {
        
        if (user.role === UserRole.HR || user.role === UserRole.EMPLOYEE) {
            throw new ForbiddenException('Bạn không có quyền xem Danh sách Kế hoạch OT');
        }

        // Admin chỉ thấy plan của các phòng không phải IT (phòng IT do Lead IT duyệt)
        if (user.role === UserRole.ADMIN) {
            qb.andWhere('creator.departmentName != :itDept', { itDept: 'IT' });
        }

        if (user.role === UserRole.DEPARTMENT_LEAD || user.role === UserRole.PROJECT_COORDINATOR) {
            qb.andWhere('creator.departmentName = :dept', {
                dept: user.departmentName,
            });
        }

        return qb;
    }

    applyFilters(
        qb: SelectQueryBuilder<OtPlan>,
        query: OtPlanListQueryDto,
        user: User
    ): SelectQueryBuilder<OtPlan> {

        if (query.status) {
            qb.andWhere('op.status = :status', { status: query.status });
        }

        if (query.search) {
            const searchPattern = `%${query.search}%`;
            qb.andWhere('(CAST(creator.id AS CHAR) LIKE :search OR creator.name LIKE :search)', {
                search: searchPattern,
            });
        }

        // Chỉ Admin mới được dùng filter phòng ban
        if (query.department && user.role === UserRole.ADMIN) {
            qb.andWhere('creator.departmentName = :deptFilter', {
                deptFilter: query.department,
            });
        }

        if (query.fromDate && query.toDate) {
            qb.andWhere('op.startTime >= :from AND op.endTime <= :to', {
                from: dayjs(query.fromDate).startOf('day').toDate(),
                to: dayjs(query.toDate).endOf('day').toDate(),
            });
        }

        if (query.month && query.year) {
            qb.andWhere('MONTH(op.startTime) = :month AND YEAR(op.startTime) = :year', {
                month: query.month,
                year: query.year,
            });
        }

        return qb;
    }
}
