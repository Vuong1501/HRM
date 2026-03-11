import {
  Controller,
  Post,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Param,
  ParseIntPipe,
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
import { HR_ERRORS } from './hr.errors';
import { InviteResultDto } from './dto/invite-result.dto';

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

  @Post('invite/resend/:outboxId')
  @ApiOperation({ summary: 'Gửi lại email mời (dành cho Admin khi gửi lỗi)' })
  @ApiResponse({ status: 200, description: 'Đã đưa vào hàng đợi gửi lại thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy lịch sử gửi email' })
  @ApiBearerAuth()
  resendInviteEmail(@Param('outboxId', ParseIntPipe) outboxId: number) {
    return this.hrService.resendInviteEmail(outboxId);
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
      throw new BadRequestException(HR_ERRORS.FILE_REQUIRED);
    }
    return this.hrService.processBulkInviteFile(file.buffer);
  }

  @Post('invite/confirm')
  async confirmBulkInvite(@Body() dto: BulkInviteDto) {
    return this.hrService.bulkInvite(dto);
  }
}
