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
import { ZohoAuthGuard } from 'src/common/guards/zoho.guard';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { LoginDevDto } from './dto/login-dev.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('zoho')
  @UseGuards(ZohoAuthGuard)
  @ApiOperation({ summary: 'Redirect sang Zoho để đăng nhập' })
  @ApiResponse({
    status: 302,
    description: 'Redirect tới Zoho OAuth',
  })
  loginZoho() {}

  @Get('zoho/callback')
  @UseGuards(AuthGuard('zoho'))
  @ApiOperation({ summary: 'Zoho callback + tạo access token' })
  @ApiResponse({
    status: 302,
    description: 'Login thành công và redirect về frontend',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
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

  @Post('dev-login')
  @ApiOperation({ summary: 'DEV login để test các quyền' })
  devLogin(@Body() dto: LoginDevDto) {
    return this.authService.devLogin(dto);
  }
}
