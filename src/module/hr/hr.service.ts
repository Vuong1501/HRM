import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Repository } from 'typeorm';
import { InviteDto } from './dto/invite.dto';
import { BulkInviteDto } from './dto/bulk-invite.dto';
import { randomUUID } from 'crypto';
import { MailService } from '../mail/mail.service';
import { UserStatus } from 'src/common/enums/user-status.enum';
import { InviteResultDto } from './dto/invite-result.dto';

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
      role: userDto.role,
      status: UserStatus.INVITED,
      inviteToken: token,

      dateOfBirth: new Date(userDto.dateOfBirth),
      departmentName: userDto.departmentName,
      address: userDto.address,
      sex: userDto.sex,
      phoneNumber: userDto.phoneNumber,
      startDate: new Date(userDto.startDate),
    });
    const user = await this.userRepository.save(entity);

    const link = `http://localhost:3000/invite/accept?token=${token}`;
    // const link = `https://undemonstrated-kinley-mischievously.ngrok-free.dev/invite/accept?token=${token}`;

    await this.mailService.sendInvite(user.email, link);

    return {
      success: true,
    };
  }

  async bulkInvite(dto: BulkInviteDto): Promise<InviteResultDto> {
    const result: InviteResultDto = {
      success: [],
      failed: [],
    };

    // lấy danh sách user đã có
    const emails = dto.users.map((u) => u.email);
    const existingUsers = await this.userRepository.find({
      where: emails.map((email) => ({ email })),
      select: ['email'],
    });
    const existingEmails = new Set(existingUsers.map((u) => u.email));

    for (const userDto of dto.users) {
      try {
        // Kiểm tra email đã tồn tại
        if (existingEmails.has(userDto.email)) {
          result.failed.push({
            user: userDto,
            reason: 'Email đã tồn tại trong hệ thống',
          });
          continue;
        }
        // Tạo user mới
        const token = randomUUID();
        const entity = this.userRepository.create({
          email: userDto.email,
          name: userDto.name,
          role: userDto.role,
          status: UserStatus.INVITED,
          inviteToken: token,
          dateOfBirth: new Date(userDto.dateOfBirth),
          departmentName: userDto.departmentName,
          address: userDto.address,
          sex: userDto.sex,
          phoneNumber: userDto.phoneNumber,
          startDate: new Date(userDto.startDate),
        });
        const user = await this.userRepository.save(entity);

        // Gửi email
        const link = `http://localhost:3000/invite/accept?token=${token}`;
        await this.mailService.sendInvite(user.email, link);

        result.success.push(userDto);
      } catch (error) {
        let reason = 'Lỗi không xác định';

        if (error instanceof Error) {
          reason = error.message;
        }

        result.failed.push({
          user: userDto,
          reason,
        });
      }
    }
    return result;
  }

  async previewBulkInvite(users: InviteDto[], rowErrors: any[]) {
    const emails = users.map((u) => u.email);

    const existingUsers = await this.userRepository.find({
      where: emails.map((email) => ({ email })),
      select: ['email'],
    });

    const existingEmails = new Set(existingUsers.map((u) => u.email));

    const valid: InviteDto[] = [];
    const existing: InviteDto[] = [];

    for (const user of users) {
      if (existingEmails.has(user.email)) {
        existing.push(user);
      } else {
        valid.push(user);
      }
    }

    return {
      valid,
      existing,
      invalid: rowErrors,
    };
  }
}
