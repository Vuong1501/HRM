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
import { APP_ERRORS } from 'src/common/errors/app.errors';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { Response } from 'express';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    @InjectRepository(User)
    private userRepositoy: Repository<User>,
    private userService: UsersService,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  async loginZoho(profile: Express.User, res: Response, inviteToken?: string) {
    let user: User | null = null;

    if (inviteToken) {
      user = await this.userRepositoy.findOne({
        where: { inviteToken },
      });

      if (!user) throw new UnauthorizedException(APP_ERRORS.INVALID_INVITE);

      if (user.status !== UserStatus.INVITED)
        throw new UnauthorizedException(APP_ERRORS.INVITE_ALREADY_USED);

      if (profile.email !== user.email)
        throw new ForbiddenException(APP_ERRORS.EMAIL_MISMATCH);

      user.status = UserStatus.ACTIVE;
      user.zohoId = profile.zohoId;
      user.inviteToken = null;

      await this.userRepositoy.save(user);
    } else {
      user = await this.userRepositoy.findOne({
        where: [{ zohoId: profile.zohoId }, { email: profile.email }],
      });

      if (!user) throw new UnauthorizedException(APP_ERRORS.USER_NOT_REGISTERED);

      if (user.status !== UserStatus.ACTIVE)
        throw new UnauthorizedException(APP_ERRORS.USER_NOT_ACTIVE);

      if (!user.zohoId) {
        user.zohoId = profile.zohoId;
        await this.userRepositoy.save(user);
      }
    }

    return this.generateTokens(user, res);
  }

  // async loginZoho(profile: Express.User) {
  //   const user = await this.userRepositoy.findOne({
  //     where: [{ zohoId: profile.zohoId }, { email: profile.email }],
  //   });

  //   if (!user) throw new UnauthorizedException('User not registered');

  //   // 🛡 status gate
  //   if (user.status !== UserStatus.ACTIVE)
  //     throw new UnauthorizedException('User not active');

  //   // 🛡 bind zohoId lần đầu
  //   if (!user.zohoId) {
  //     // email match protection
  //     if (profile.email !== user.email)
  //       throw new UnauthorizedException('Email mismatch');

  //     user.zohoId = profile.zohoId;
  //     await this.userRepositoy.save(user);
  //   }

  //   const payload = {
  //     sub: user.id,
  //     email: user.email,
  //     role: user.role,
  //   };

  //   return {
  //     accessToken: await this.jwtService.signAsync(payload),
  //     user: this.userService.toResponse(user),
  //   };
  // }

  async devLogin(dto: LoginDevDto, res: Response) {
    if (this.config.get('NODE_ENV') === 'production') {
      this.logger.warn('Dev chỉ login ở development');
      throw new ForbiddenException(APP_ERRORS.DEV_LOGIN_DISABLED);
    }

    const user = await this.userRepositoy.findOne({
      where: { email: dto.email },
    });

    if (!user) {
      this.logger.warn(`Dev login user not found: ${dto.email}`);
      throw new NotFoundException(APP_ERRORS.USER_NOT_FOUND);
    }
    this.logger.log(`Dev login success: ${user.email}`);
    return this.generateTokens(user, res);
  }

  async refreshTokens(user: User, res: Response) {
    // user đã được validate trong JwtRefreshStrategy
    return this.generateTokens(user, res);
  }

  async logout(userId: number, res: Response) {
    // Xóa hash refresh token trong DB
    await this.userRepositoy.update(userId, { refreshToken: null });

    // Clear cookie
    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: this.config.get('NODE_ENV') === 'production',
      sameSite: 'strict',
    });

    return { message: 'Đăng xuất thành công' };
  }

  async generateTokens(user: User, res: Response){
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    }

    const [accessToken, refreshToken ] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.config.get('JWT_SECRET'),
        expiresIn: this.config.get('JWT_EXPIRE'), // '15m'
      }),
      this.jwtService.signAsync(payload, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get('JWT_REFRESH_EXPIRE'), // '7d'
      }),
    ])

    // hash refreshToken
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    await this.userRepositoy.update(user.id, {refreshToken: hashedRefreshToken});

    // gửi refresh qua cookie
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: this.config.get('NODE_ENV') === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })

    return {
      accessToken,
    }
  }
}
