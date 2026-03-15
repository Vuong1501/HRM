import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { OutboxMail } from '../mail/entities/outbox-mail.entity';
import { OutboxStatus } from 'src/common/enums/outbox-status.enum';
import { User } from '../users/entities/user.entity';
import { DataSource, Repository } from 'typeorm';
import { InviteDto } from './dto/invite.dto';
import { BulkInviteDto } from './dto/bulk-invite.dto';
import { randomUUID } from 'crypto';
import { MailService } from '../mail/mail.service';
import { UserStatus } from 'src/common/enums/user-status.enum';
import { InviteResultDto } from './dto/invite-result.dto';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
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
  private readonly logger = new Logger(HrService.name);
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(OutboxMail)
    private outboxRepository: Repository<OutboxMail>,
    private mailService: MailService,
    private configService: ConfigService,
    private dataSource: DataSource
  ) {}

  // api mời 1 người
  async invite(userDto: InviteDto) {
    const existed = await this.userRepository.findOne({
      where: { email: userDto.email },
    });
    if (existed) throw new ConflictException(HR_ERRORS.EMAIL_ALREADY_EXISTS);
    const token = randomUUID();
    const frontendUrl = this.configService.get<string>('BACKEND_URL');
    const link = `${frontendUrl}/invite/accept?token=${token}`;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
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

      const outbox = queryRunner.manager.create(OutboxMail, {
        recipient: userDto.email,
        template: 'invite',
        contextJson: JSON.stringify({ link }),
        status: OutboxStatus.PENDING,
      });
      const savedOutbox = await queryRunner.manager.save(outbox);

      await queryRunner.commitTransaction();

      // Gửi mail trong background
      this.mailService.sendMailWithRetry(
        () => this.mailService.sendInvite(user.email, link),
        'SEND_INVITE_FAILED',
        savedOutbox.id,
      ).catch((e) => this.logger.error('Gửi mail thất bại:', e));

      return {
        success: true,
      };

    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // api resend lại mail khi lỗi sau tất cả
  async resendInviteEmail(outboxId: number) {
    const outbox = await this.outboxRepository.findOne({ where: { id: outboxId } });
    if (!outbox) {
      throw new ConflictException({
        code: 'OUTBOX_NOT_FOUND',
        message: 'Không tìm thấy lịch sử gửi email này',
      });
    }

    if (outbox.status === OutboxStatus.SUCCESS) {
      throw new ConflictException({
        code: 'MAIL_ALREADY_SENT',
        message: 'Email này đã được gửi thành công trước đó',
      });
    }

    await this.outboxRepository.update(outboxId, { status: OutboxStatus.PENDING, retryCount: 0 });

    const context = JSON.parse(outbox.contextJson);

    this.mailService.sendMailWithRetry(
      () => this.mailService.sendInvite(outbox.recipient, context.link),
      'SEND_INVITE_FAILED',
      outbox.id,
      false
    ).catch(e => this.logger.error('Admin resend mail failed', e));

    return {
      success: true,
      message: 'Email đã được đưa vào hàng đợi gửi lại',
    };
  }

  // api mời nhiều người cùng lúc
  async bulkInvite(dto: BulkInviteDto): Promise<InviteResultDto> {
    const result: InviteResultDto = { success: [], failed: [] };

    const emails = dto.users.map((u) => u.email);
    const existingUsers = await this.userRepository.find({
      where: emails.map((email) => ({ email })),
      select: ['email'],
    });
    const existingEmails = new Set(existingUsers.map((u) => u.email));

    const usersToInsert: Array<Partial<User> & { _inviteLink: string; _dto: typeof dto.users[number] }> = [];
    for(const userDto of dto.users){
      if (existingEmails.has(userDto.email)) {
        result.failed.push({ user: userDto, reason: 'Email đã tồn tại trong hệ thống' });
        continue;
      }
      existingEmails.add(userDto.email);

      const token = randomUUID();
      const frontendUrl = this.configService.getOrThrow<string>('BACKEND_URL');
      const inviteLink = `${frontendUrl}/invite/accept?token=${token}`;

      usersToInsert.push({
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
        _inviteLink: inviteLink,
        _dto: userDto,
      });
    }

    if (usersToInsert.length === 0) return result;

    //bắt đầu transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    // Mảng gom các thông tin mail cần gửi ngầm sau khi chốt DB
    const mailQueue: { email: string; link: string; outboxId: number }[] = [];

    try {
      await queryRunner.query('SAVEPOINT bulk_invite');

      try {
        // 1query insert các users
        const insertedUsers = await queryRunner.manager.save(
          User,
          usersToInsert.map(({ _inviteLink, _dto, ...userData }) => userData)
        ); 

        // 1query  insert các outbox mail
        const outboxEntities = insertedUsers.map((user, i) =>
          queryRunner.manager.create(OutboxMail, {
            recipient: user.email,
            template: 'invite',
            contextJson: JSON.stringify({ link: usersToInsert[i]._inviteLink }),
            status: OutboxStatus.PENDING,
          })
        );
        const savedOutboxes = await queryRunner.manager.save(OutboxMail, outboxEntities);

        // lưu vào 1 mảng để tí nữa gửi mail nền
        insertedUsers.forEach((user, i) => {
          mailQueue.push({
            email: user.email,
            link: usersToInsert[i]._inviteLink,
            outboxId: savedOutboxes[i].id,
          });
          result.success.push(usersToInsert[i]._dto);
        });
      } catch (error) {
        // nếu ở trên bulk lỗi thì nó mới savepoint từng chỗ
        await queryRunner.query('ROLLBACK TO SAVEPOINT bulk_invite');
        for(const userData of usersToInsert){
          await queryRunner.query('SAVEPOINT single_user');
          try {
            const user = await queryRunner.manager.save(User, {
              ...userData,
              _inviteLink: undefined,
              _dto: undefined,
            });

            const outbox = queryRunner.manager.create(OutboxMail, {
              recipient: user.email,
              template: 'invite',
              contextJson: JSON.stringify({ link: userData._inviteLink }),
              status: OutboxStatus.PENDING,
            });
            const savedOutbox = await queryRunner.manager.save(outbox);

            await queryRunner.query('RELEASE SAVEPOINT single_user');

            mailQueue.push({ email: user.email, link: userData._inviteLink, outboxId: savedOutbox.id });
            result.success.push(userData._dto);
          } catch (error) {
            await queryRunner.query('ROLLBACK TO SAVEPOINT single_user');
          result.failed.push({
            user: userData._dto,
            reason: error instanceof Error ? error.message : 'Lỗi không xác định',
          });
          }
        }
      }
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
    
    Promise.all(
        mailQueue.map(({ email, link, outboxId }) =>
          this.mailService.sendMailWithRetry(
            () => this.mailService.sendInvite(email, link),
            'SEND_INVITE_FAILED',
            outboxId
          ).catch(e => this.logger.error(`Bulk Background send mail failed for ${email}`, e))
        )
      );

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

