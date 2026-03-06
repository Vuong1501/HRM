import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { DataSource, Repository } from 'typeorm';
import { InviteDto } from './dto/invite.dto';
import { BulkInviteDto } from './dto/bulk-invite.dto';
import { randomUUID } from 'crypto';
import { MailService } from '../mail/mail.service';
import { UserStatus } from 'src/common/enums/user-status.enum';
import { InviteResultDto } from './dto/invite-result.dto';
import { ConfigService } from '@nestjs/config';
import dayjs from 'dayjs';


@Injectable()
export class HrService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private mailService: MailService,
    private configService: ConfigService,
    private dataSource: DataSource
  ) {}

  async invite(userDto: InviteDto) {
    const existed = await this.userRepository.findOne({
      where: { email: userDto.email },
    });
    if (existed) throw new ConflictException('User existed');
    const token = randomUUID();
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const link = `${frontendUrl}/invite/accept?token=${token}`;

    await this.dataSource.transaction(async (manager) => {
      const entity = manager.create(User, {
        email: userDto.email,
        name: userDto.name,
        role: userDto.role,
        status: UserStatus.INVITED,
        inviteToken: token,

        dateOfBirth: dayjs(userDto.dateOfBirth).toDate(),
        departmentName: userDto.departmentName,
        address: userDto.address,
        sex: userDto.sex,
        phoneNumber: userDto.phoneNumber,
        startDate: dayjs(userDto.startDate).toDate(),
      });
      const user = await manager.save(entity);
      // gửi mail
      await this.mailService.sendMailWithRetry(
        () => this.mailService.sendInvite(user.email, link),
        'SEND_INVITE_FAILED',
      );
    })
    return {
      success: true,
    };
  }

async bulkInvite(dto: BulkInviteDto): Promise<InviteResultDto> {
  const result: InviteResultDto = { success: [], failed: [] };

  const emails = dto.users.map((u) => u.email);
  const existingUsers = await this.userRepository.find({
    where: emails.map((email) => ({ email })),
    select: ['email'],
  });
  const existingEmails = new Set(existingUsers.map((u) => u.email));

  const queryRunner = this.dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    for (const userDto of dto.users) {
      if (existingEmails.has(userDto.email)) {
        result.failed.push({ user: userDto, reason: 'Email đã tồn tại trong hệ thống' });
        continue;
      }


      await queryRunner.query('SAVEPOINT user_savepoint');

      try {
        const token = randomUUID();
        const entity = queryRunner.manager.create(User, {
          email: userDto.email,
          name: userDto.name,
          role: userDto.role,
          status: UserStatus.INVITED,
          inviteToken: token,
          dateOfBirth: dayjs(userDto.dateOfBirth).toDate(),
          departmentName: userDto.departmentName,
          address: userDto.address,
          sex: userDto.sex,
          phoneNumber: userDto.phoneNumber,
          startDate: dayjs(userDto.startDate).toDate(),
        });

        const user = await queryRunner.manager.save(entity);

        const frontendUrl = this.configService.getOrThrow<string>('FRONTEND_URL');
        const inviteLink = `${frontendUrl}/invite/accept?token=${token}`;

        await this.mailService.sendMailWithRetry(
          () => this.mailService.sendInvite(user.email, inviteLink),
          'SEND_INVITE_FAILED',
        );


        await queryRunner.query('RELEASE SAVEPOINT user_savepoint');
        result.success.push(userDto);

      } catch (error) {

        await queryRunner.query('ROLLBACK TO SAVEPOINT user_savepoint');
        result.failed.push({
          user: userDto,
          reason: error instanceof Error ? error.message : 'Lỗi không xác định',
        });
      }
    }

    await queryRunner.commitTransaction();
    return result;

  } catch (error) {
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    await queryRunner.release();
  }
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
