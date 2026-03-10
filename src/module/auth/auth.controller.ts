import {
  Controller,
  Get,
  Req,
  Post,
  Body,
  UseGuards,
  UnauthorizedException,
  Res,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
// import { ZohoAuthGuard } from 'src/common/guards/zoho.guard';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { LoginDevDto } from './dto/login-dev.dto';
import { APP_ERRORS } from 'src/common/errors/app.errors';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { JwtRefreshGuard } from 'src/common/guards/jwt-refresh.guard';
import type { RequestWithUser } from 'src/common/interfaces/request-with-user.interface';
import { User } from '../users/entities/user.entity';
import { ConfigService } from '@nestjs/config';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Get('zoho')
  @UseGuards(AuthGuard('zoho'))
  @ApiOperation({ summary: 'Redirect sang Zoho để đăng nhập' })
  @ApiResponse({ status: 302, description: 'Redirect tới Zoho OAuth' })
  loginZoho() {}

  @Get('zoho/callback')
  @UseGuards(AuthGuard('zoho'))
  @ApiOperation({ summary: 'Zoho callback + tạo access token & refresh token' })
  @ApiResponse({ status: 302, description: 'Login thành công và redirect về frontend' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async zohoCallback(@Req() req: Express.Request, @Res() res: Response) {
    if (!req.user) {
      throw new UnauthorizedException(APP_ERRORS.UNAUTHORIZED);
    }
    const inviteToken = req.cookies.invite_token;
    const result = await this.authService.loginZoho(req.user, res, inviteToken);
    res.clearCookie('invite_token');

    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
    return res.redirect(
      `${frontendUrl}/login-success?accessToken=${result.accessToken}`,
    );
  }

  @Post('dev-login')
  @ApiOperation({ summary: 'DEV login để test các quyền' })
  devLogin(@Body() dto: LoginDevDto, @Res({ passthrough: true }) res: Response) {
    return this.authService.devLogin(dto, res);
  }

  // Dùng refresh token (từ httpOnly cookie) để lấy access token mới

  @Post('refresh')
  @UseGuards(JwtRefreshGuard)
  @ApiOperation({ summary: 'Refresh access token bằng refresh token trong cookie' })
  @ApiResponse({ status: 200, description: 'Trả về accessToken mới' })
  @ApiResponse({ status: 401, description: 'Refresh token không hợp lệ hoặc hết hạn' })
  async refresh(@Req() req: Request & { user: User }, @Res({ passthrough: true }) res: Response) {
    return this.authService.refreshTokens(req.user, res);
  }

  // Đăng xuất — xóa refresh token trong DB + clear cookie

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Đăng xuất, thu hồi refresh token' })
  @ApiResponse({ status: 200, description: 'Đăng xuất thành công' })
  async logout(@Req() req: RequestWithUser, @Res({ passthrough: true }) res: Response) {
    return this.authService.logout(req.user.userId, res);
  }
}
