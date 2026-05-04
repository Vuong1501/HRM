import { Injectable, NotFoundException } from '@nestjs/common';
import { APP_ERRORS } from 'src/common/errors/app.errors';
// import * as bcrypt from 'bcrypt';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';
import { UserResponseDto } from './dto/user-response.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
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
}
