import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Repository } from 'typeorm';
import { InviteDto } from './dto/invite.dto';
import { randomUUID } from 'crypto';
import { MailService } from '../mail/mail.service';
import { UserRole } from 'src/common/enums/user-role.enum';
import { UserStatus } from 'src/common/enums/user-status.enum';

@Injectable()
export class HrService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private mailService: MailService,
  ) {}

  async invite(userDto: InviteDto) {
    const existed = await this.userRepository.findOne({
      where: { email: userDto.email },
    });
    if (existed) throw new ConflictException('User existed');
    const token = randomUUID();
    const entity = this.userRepository.create({
      email: userDto.email,
      name: userDto.name,
      role: UserRole.EMPLOYEE,
      status: UserStatus.INVITED,
      inviteToken: token,
    });
    const user = await this.userRepository.save(entity);

    const link = `http://localhost:5173/invite?token=${token}`;

    await this.mailService.sendInvite(user.email, link);

    return {
      success: true,
    };
  }
}
