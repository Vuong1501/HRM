import { Controller, Res } from '@nestjs/common';
import { InviteService } from './invite.service';
import { Get, Query } from '@nestjs/common';
import type {Response } from 'express';


@Controller('invite')
export class InviteController {
  constructor(private readonly inviteService: InviteService) {}

    @Get('accept')
    async accept(@Query('token') token: string, @Res() res: Response) {
        return this.inviteService.acceptInvite(token, res);
    }
}
