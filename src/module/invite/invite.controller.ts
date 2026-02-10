import { Controller, Res, UnauthorizedException } from '@nestjs/common';
import { InviteService } from './invite.service';
import { User } from '../users/entities/user.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Get, Query } from '@nestjs/common';
import { UserStatus } from 'src/common/enums/user-status.enum';
import type { Request, Response } from 'express';

@Controller('invite')
export class InviteController {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  @Get('accept')
  async accept(@Query('token') token: string, @Res() res: Response) {
    const user = await this.userRepo.findOne({
      where: { inviteToken: token },
    });

    if (!user) throw new UnauthorizedException('Invalid invite');

    if (user.status !== UserStatus.INVITED)
      throw new UnauthorizedException('Invite already used');

    res.cookie('invite_token', token, {
      httpOnly: true,
      maxAge: 10 * 60 * 1000, // 10 phút
    });

    // redirect sang Zoho login
    return res.redirect('http://localhost:5173/login?invited=true');

    // delop dùng cách này
    // return res.redirect('https://fe-intern-sky.vercel.app/login?invited=true');

    // return res.redirect(
    //   'https://undemonstrated-kinley-mischievously.ngrok-free.dev',
    // );
  }
}
