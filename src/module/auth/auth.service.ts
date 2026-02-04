import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { UserStatus } from 'src/common/enums/user-status.enum';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepositoy: Repository<User>,
    private userService: UsersService,
    private jwtService: JwtService,
  ) {}

  async loginZoho(profile: Express.User, token: string) {
    let user: User;
    if (token) {
      const invitedUser = await this.userRepositoy.findOne({
        where: { inviteToken: token },
      });
      console.log('vào if');

      if (!invitedUser) {
        throw new UnauthorizedException('Invalid invite');
      }

      if (invitedUser.status === UserStatus.INVITED) {
        invitedUser.status = UserStatus.ACTIVE;
        invitedUser.zohoId = profile.zohoId;
        invitedUser.inviteToken = null;

        await this.userRepositoy.save(invitedUser);
      }
      user = invitedUser;
    } else {
      const existedUser = await this.userRepositoy.findOne({
        where: [{ zohoId: profile.zohoId }, { email: profile.email }],
      });
      if (!existedUser) {
        throw new UnauthorizedException('User not registered');
      }
      user = existedUser;
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      user: this.userService.toResponse(user),
    };
  }
}
