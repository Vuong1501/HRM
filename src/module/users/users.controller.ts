import {
  Controller,
  Get,
  Body,
  UseGuards,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import type { Request } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('/me')
  @ApiOperation({ summary: 'Thông tin người đang đăng nhập' })
  @ApiBearerAuth()
  getMe(@Req() req: Request) {
    if (!req.user) {
      throw new UnauthorizedException();
    }
    return this.usersService.getMe(req.user.userId);
  }
}
