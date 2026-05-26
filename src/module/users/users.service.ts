import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { APP_ERRORS } from 'src/common/errors/app.errors';
// import * as bcrypt from 'bcrypt';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';
import { UserResponseDto } from './dto/user-response.dto';
import { EmployeeListQueryDto } from './dto/employee-list-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { EmploymentType } from 'src/common/enums/user-employeeType.enum';
import dayjs from 'dayjs';
import { LeaveAccrualService } from '../leave/leave-accrual.service';
import { USER_ERRORS } from './users.error';
import { UserStatus } from 'src/common/enums/user-status.enum';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private readonly leaveAccrualService: LeaveAccrualService,
  ) {}

  toResponse(user: User): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      departmentName: user.departmentName,
      role: user.role,
      createdAt: user.createdAt,
    };
  }

  async getMe(id: number) {
    const user = await this.userRepository.findOneBy({ id });
    if (!user) {
      throw new NotFoundException(APP_ERRORS.USER_NOT_FOUND);
    }
    return this.toResponse(user);
  }

  async findOne(id: number) {
    const user = await this.userRepository.findOneBy({ id });
    if (!user) {
      throw new NotFoundException(APP_ERRORS.USER_NOT_FOUND);
    }
    return this.toResponse(user);
  }

  async findOneEntity(id: number) {
    const user = await this.userRepository.findOneBy({ id });
    if (!user) {
      throw new NotFoundException(APP_ERRORS.USER_NOT_FOUND);
    }
    return user;
  }

  async getEmployeesList(requesterId: number, search?: string) {
    const requester = await this.userRepository.findOneBy({ id: requesterId });
    if (!requester) {
      throw new NotFoundException(APP_ERRORS.USER_NOT_FOUND);
    }

    const query = this.userRepository.createQueryBuilder('user')
      .select([
        'user.id', 
        'user.name', 
        'user.departmentName', 
        'user.role', 
      ]);

    // Tất cả mọi người (kể cả admin) chỉ xem được nhân viên trong cùng phòng ban của mình
    if (!requester.departmentName) {
      return []; // Nếu người dùng chưa được gán phòng ban thì trả về mảng rỗng
    }
    query.where('user.departmentName = :dept', { dept: requester.departmentName });

    if (search) {
      query.andWhere('(user.name LIKE :search)', { search: `%${search}%` });
    }

    return await query.getMany();
  }

  // Lấy danh sách nhân viên toàn công ty (HR/Admin)
  async getCompanyEmployees(query: EmployeeListQueryDto) {
    const { page = 1, limit = 10, search, departmentName } = query;

    const qb = this.userRepository
      .createQueryBuilder('user')
      .select([
        'user.id',
        'user.name',
        'user.email',
        'user.role',
        'user.status',
        'user.departmentName',
        'user.employmentType',
        'user.phoneNumber',
        'user.startDate',
        'user.officialDate',
        'user.address'
      ]);

    if (search) {
      qb.andWhere(
        '(user.name LIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (departmentName) {
      qb.andWhere('user.departmentName = :departmentName', { departmentName });
    }

    qb.orderBy('user.name', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      lastPage: Math.ceil(total / limit),
    };
  }

  async updateUser(userId: number, dto: UpdateUserDto){
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) throw new NotFoundException(USER_ERRORS.USER_NOT_FOUND);

    const newRole = dto.role || user.role;
    const newDepartment = dto.departmentName || user.departmentName;

    if (newRole === 'pc' && newDepartment !== 'IT') {
      throw new BadRequestException(USER_ERRORS.PC_ROLE_CAN_ONLY_BE_IN_IT_DEPARTMENT);
    }

    // Khi chuyển sang OFFICIAL thì bắt buộc có officialDate
    const isUpgradingToOfficial = 
        dto.employmentType === EmploymentType.OFFICIAL && 
        user.employmentType !== EmploymentType.OFFICIAL;

    if (isUpgradingToOfficial && !dto.officialDate && !user.officialDate) {
        throw new BadRequestException(USER_ERRORS.OFFICIAL_DATE_REQUIRED);
    }

    Object.assign(user, {
        ...dto,
        startDate: dto.startDate ? dayjs(dto.startDate).toDate() : user.startDate,
        officialDate: dto.officialDate ? dayjs(dto.officialDate).toDate() : user.officialDate,
        dateOfBirth: dto.dateOfBirth ? dayjs(dto.dateOfBirth).toDate() : user.dateOfBirth,
    });

    await this.userRepository.save(user);
    // Backfill phép khi lên chính thức
    if (isUpgradingToOfficial) {
        await this.leaveAccrualService.backfillLeaveForUser(user);
    }

    return { message: 'Cập nhật nhân viên thành công' };
  }

  async inactiveUser(userId: number) {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) throw new NotFoundException(USER_ERRORS.USER_NOT_FOUND);

    user.status = UserStatus.DISABLED;
    await this.userRepository.save(user);

    return { message: 'Đã vô hiệu hóa nhân viên thành công' };
  }
}
