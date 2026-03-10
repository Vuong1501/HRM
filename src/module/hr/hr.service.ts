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
import * as XLSX from 'xlsx';
import { HR_ERRORS } from './hr.errors';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { RawInviteRow } from './dto/raw-invite-row';
import {
  normalizeDate,
  normalizeRole,
  HEADER_MAP,
  normalizeRowKeys,
  getValueByAliases,
} from 'src/common/helper/excel-normalizer';


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
    if (existed) throw new ConflictException(HR_ERRORS.EMAIL_ALREADY_EXISTS);
    const token = randomUUID();
    const frontendUrl = this.configService.get<string>('BACKEND_URL');
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

        const frontendUrl = this.configService.getOrThrow<string>('BACKEND_URL');
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
  async processBulkInviteFile(fileBuffer: Buffer) {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);

    const users: InviteDto[] = [];
    const errors: any[] = [];
    rows.forEach((originalRow, index) => {
      try {
        const row = normalizeRowKeys(originalRow);
        if (Object.values(row).every((value) => !value)) {
          return;
        }

        const raw: RawInviteRow = {
          email: getValueByAliases(row, HEADER_MAP.email) as string,
          name: getValueByAliases(row, HEADER_MAP.name) as string,
          dob: getValueByAliases(row, HEADER_MAP.dob) as string | number | Date | undefined,
          department: getValueByAliases(row, HEADER_MAP.department) as string,
          roleRaw: getValueByAliases(row, HEADER_MAP.roleRaw) as string,
          address: getValueByAliases(row, HEADER_MAP.address) as string,
          sex: getValueByAliases(row, HEADER_MAP.sex) as string,
          phone: getValueByAliases(row, HEADER_MAP.phone) as string,
          startDate: getValueByAliases(row, HEADER_MAP.startDate) as string | number | Date | undefined,
        };

        const roleInfo = normalizeRole(raw.roleRaw ?? '');
        const phone = raw.phone ? String(raw.phone).trim() : '';

        const dto = plainToInstance(InviteDto, {
          email: raw.email,
          name: raw.name,
          dateOfBirth: normalizeDate(raw.dob),
          departmentName: raw.department,
          role: roleInfo.role,
          employmentType: roleInfo.employmentType,
          address: raw.address,
          sex: raw.sex?.toLowerCase(),
          phoneNumber: phone ? (phone.startsWith('0') ? phone : `0${phone}`) : '',
          startDate: normalizeDate(raw.startDate),
        });

        const validateErrors = validateSync(dto);
        if (validateErrors.length) {
          const messages = validateErrors
            .map((err) => Object.values(err.constraints ?? {}).join(', '))
            .join('; ');
          throw new Error(messages);
        }

        users.push(dto);
      } catch (e: unknown) {
        errors.push({
          row: index + 2,
          reason: e instanceof Error ? e.message : 'Unknown error',
        });
      }
    });
    return this.previewBulkInvite(users, errors);
  }
}
