import {
  Controller,
  Get,
  Req,
  UseGuards,
  UnauthorizedException,
  Res,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import { ZohoAuthGuard } from 'src/common/guards/zoho.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('zoho')
  @UseGuards(ZohoAuthGuard)
  loginZoho() {}

  @Get('zoho/callback')
  @UseGuards(AuthGuard('zoho'))
  async zohoCallback(@Req() req: Request, @Res() res: Response) {
    const token = req.query.state as string;
    if (!req.user) {
      throw new UnauthorizedException();
    }
    const result = await this.authService.loginZoho(req.user, token);
    return res.redirect(
      `http://localhost:5173/login-success?accessToken=${result.accessToken}&user=${encodeURIComponent(JSON.stringify(result.user))}`,
    );
  }
}
