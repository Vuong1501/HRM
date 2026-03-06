import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from 'src/module/users/entities/user.entity';
import { Request } from 'express';
import * as bcrypt from 'bcrypt';
import { APP_ERRORS } from 'src/common/errors/app.errors';

interface JwtPayload {
  sub: number;
  email: string;
  role: string;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(
    config: ConfigService,
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {
    const secret = config.get<string>('JWT_REFRESH_SECRET');
    if (!secret) throw new Error('JWT_REFRESH_SECRET is missing');

    super({
      // Đọc refreshToken từ httpOnly cookie
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => req?.cookies?.refresh_token ?? null,
      ]),
      secretOrKey: secret,
      passReqToCallback: true, // để validate() nhận được req (đọc cookie)
    });
  }

  async validate(req: Request, payload: JwtPayload): Promise<User> {
    const refreshToken = req.cookies?.refresh_token as string;

    if (!refreshToken) throw new UnauthorizedException(APP_ERRORS.REFRESH_TOKEN_MISSING);

    const user = await this.userRepo.findOneBy({ id: payload.sub });

    if (!user || !user.refreshToken) {
      throw new UnauthorizedException(APP_ERRORS.REFRESH_TOKEN_INVALID);
    }

    // So sánh token từ cookie với hash trong DB
    const isMatch = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!isMatch) throw new UnauthorizedException(APP_ERRORS.REFRESH_TOKEN_MISMATCH);

    return user; // gán vào req.user
  }
}
