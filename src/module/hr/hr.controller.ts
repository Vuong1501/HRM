import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { HrService } from './hr.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { InviteDto } from './dto/invite.dto';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

@ApiTags('hr')
@Controller('hr')
export class HrController {
  constructor(private readonly hrService: HrService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('hr')
  @Post('invite')
  @ApiOperation({ summary: 'HR mời nhân viên mới' })
  @ApiResponse({ status: 201, description: 'Mời thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiBearerAuth()
  invite(@Body() userDto: InviteDto) {
    return this.hrService.invite(userDto);
  }
}
