import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { UserStatus } from 'src/common/enums/user-status.enum';
import { LoginDevDto } from './dto/login-dev.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
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

      if (!invitedUser) {
        this.logger.warn(`Invalid invite token`);
        throw new UnauthorizedException('Invalid invite');
      }

      if (invitedUser.status === UserStatus.INVITED) {
        invitedUser.status = UserStatus.ACTIVE;
        invitedUser.zohoId = profile.zohoId;
        invitedUser.inviteToken = null;

        await this.userRepositoy.save(invitedUser);
        this.logger.log(`User activated via invite: ${invitedUser.email}`);
      }
      user = invitedUser;
    } else {
      const existedUser = await this.userRepositoy.findOne({
        where: [{ zohoId: profile.zohoId }, { email: profile.email }],
      });
      if (!existedUser) {
        this.logger.warn(`Zoho user not registered: ${profile.email}`);
        throw new UnauthorizedException('User not registered');
      }
      user = existedUser;
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    this.logger.log(`Zoho login success: ${user.email}`);
    return {
      accessToken: await this.jwtService.signAsync(payload),
      user: this.userService.toResponse(user),
    };
  }

  async devLogin(dto: LoginDevDto) {
    if (process.env.NODE_ENV === 'production') {
      this.logger.warn('Dev chỉ login ở development');
      throw new ForbiddenException('Dev login disabled in production');
    }

    const user = await this.userRepositoy.findOne({
      where: { email: dto.email },
    });

    if (!user) {
      this.logger.warn(`Dev login user not found: ${dto.email}`);
      throw new NotFoundException('User not found');
    }
    const payload = {
      sub: user.id,
      role: user.role,
    };
    this.logger.log(`Dev login success: ${user.email}`);
    return {
      accessToken: this.jwtService.sign(payload),
    };
  }
}
