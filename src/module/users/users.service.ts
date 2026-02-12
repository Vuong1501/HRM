import { Injectable } from '@nestjs/common';
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

  // async create(createUserDto: CreateUserDto) {
  //   const existed = await this.userRepository.findOne({
  //     where: { email: createUserDto.email },
  //   });
  //   if (existed) {
  //     throw new ConflictException('Email already exists');
  //   }
  //   const hashPassword = await bcrypt.hash(createUserDto.password, 10);
  //   const user = await this.userRepository.save({
  //     email: createUserDto.email,
  //     password: hashPassword,
  //     name: createUserDto.name,
  //   });
  //   return this.toResponse(user);
  // }
  async getMe(id: number) {
    const user = await this.userRepository.findOneBy({ id });
    if (!user) {
      throw new Error('Không tồn tại user');
    }
    return this.toResponse(user);
  }
}
