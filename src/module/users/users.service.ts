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
}
