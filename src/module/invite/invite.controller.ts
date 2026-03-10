import { Controller, Res, UnauthorizedException } from '@nestjs/common';
import { InviteService } from './invite.service';
import { User } from '../users/entities/user.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Get, Query } from '@nestjs/common';
import { UserStatus } from 'src/common/enums/user-status.enum';
import type { Request, Response } from 'express';
import { APP_ERRORS } from 'src/common/errors/app.errors';

import { ConfigService } from '@nestjs/config';

@Controller('invite')
export class InviteController {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private configService: ConfigService,
  ) {}

  @Get('accept')
  async accept(@Query('token') token: string, @Res() res: Response) {
    const user = await this.userRepo.findOne({
      where: { inviteToken: token },
    });

    if (!user) throw new UnauthorizedException(APP_ERRORS.INVALID_INVITE);

    if (user.status !== UserStatus.INVITED)
      throw new UnauthorizedException(APP_ERRORS.INVITE_ALREADY_USED);

    res.cookie('invite_token', token, {
      httpOnly: true,
      maxAge: 10 * 60 * 1000, // 10 phút
    });

    // redirect sang Zoho login
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
    return res.redirect(`${frontendUrl}/login?invited=true`);
  }
}
