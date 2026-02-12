import {
  Controller,
  Post,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { HrService } from './hr.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { InviteDto } from './dto/invite.dto';
import { BulkInviteDto } from './dto/bulk-invite.dto';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import * as XLSX from 'xlsx';
import { InviteResultDto } from './dto/invite-result.dto';
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

@ApiTags('hr')
@Controller('hr')
export class HrController {
  constructor(private readonly hrService: HrService) {}

  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles('hr')
  @Post('invite')
  @ApiOperation({ summary: 'HR mời nhân viên mới' })
  @ApiResponse({ status: 201, description: 'Mời thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiBearerAuth()
  invite(@Body() userDto: InviteDto) {
    return this.hrService.invite(userDto);
  }

  @Post('invite/upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Mời hàng loạt user qua file Excel' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Upload file và preview danh sách hợp lệ',
    type: InviteResultDto,
  })
  @ApiBearerAuth()
  async uploadBulkInvite(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Vui lòng upload file');
    }

    // Đọc file Excel
    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);
    console.log('rows', rows);

    const users: InviteDto[] = [];
    const errors: any[] = [];
    rows.forEach((originalRow, index) => {
      try {
        const row = normalizeRowKeys(originalRow);
        // bỏ qua các dòng rỗng, every kiểm tra tất cả các cột nếu rỗng
        if (Object.values(row).every((value) => !value)) {
          return;
        }
        console.log('row moiwsii>>>>', row);

        const raw: RawInviteRow = {
          email: getValueByAliases(row, HEADER_MAP.email) as string,
          name: getValueByAliases(row, HEADER_MAP.name) as string,
          dob: getValueByAliases(row, HEADER_MAP.dob) as
            | string
            | number
            | Date
            | undefined,
          department: getValueByAliases(row, HEADER_MAP.department) as string,
          roleRaw: getValueByAliases(row, HEADER_MAP.roleRaw) as string,
          address: getValueByAliases(row, HEADER_MAP.address) as string,
          sex: getValueByAliases(row, HEADER_MAP.sex) as string,
          phone: getValueByAliases(row, HEADER_MAP.phone) as string,
          startDate: getValueByAliases(row, HEADER_MAP.startDate) as
            | string
            | number
            | Date
            | undefined,
        };

        console.log('rawww>>>>>', raw);

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
          phoneNumber: phone
            ? phone.startsWith('0')
              ? phone
              : `0${phone}`
            : '',
          startDate: normalizeDate(raw.startDate),
        });

        console.log('dto>>>', dto);

        const validateErrors = validateSync(dto);
        if (validateErrors.length) {
          console.log(JSON.stringify(errors, null, 2));
          const messages = validateErrors
            .map((err) => Object.values(err.constraints ?? {}).join(', '))
            .join('; ');
          throw new Error(messages);
        }

        users.push(dto);
      } catch (e: unknown) {
        console.log('eee', e);

        errors.push({
          row: index + 2,
          reason: e instanceof Error ? e.message : 'Unknown error',
        });
      }
    });
    return this.hrService.previewBulkInvite(users, errors);
  }

  @Post('invite/confirm')
  async confirmBulkInvite(@Body() dto: BulkInviteDto) {
    return this.hrService.bulkInvite(dto);
  }
}
