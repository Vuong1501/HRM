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

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('/me')
  getMe(@Req() req: Request) {
    if (!req.user) {
      throw new UnauthorizedException();
    }
    return this.usersService.getMe(req.user.userId);
  }
}
