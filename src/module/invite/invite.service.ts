import { Injectable } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import { User } from '../users/entities/user.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { UserStatus } from 'src/common/enums/user-status.enum';
import type { Response } from 'express';
import { APP_ERRORS } from 'src/common/errors/app.errors';

import { ConfigService } from '@nestjs/config';

@Injectable()
export class InviteService {
    constructor(
        @InjectRepository(User)
        private userRepo: Repository<User>,
        private configService: ConfigService,
    ) {}

    async acceptInvite(token: string, res: Response) {
        const user = await this.userRepo.findOne({
            where: { inviteToken: token },
        });

        if (!user) throw new UnauthorizedException(APP_ERRORS.INVALID_INVITE);

        if (user.status !== UserStatus.INVITED)
            throw new UnauthorizedException(APP_ERRORS.INVITE_ALREADY_USED);

        res.cookie('invite_token', token, {
            httpOnly: true,
            maxAge: 10 * 60 * 1000,
        });

        const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
        return res.redirect(`${frontendUrl}/login?invited=true`);
    }
}
