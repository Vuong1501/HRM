import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { HrService } from './hr.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { InviteDto } from './dto/invite.dto';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';

@Controller('hr')
export class HrController {
  constructor(private readonly hrService: HrService) {}

  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles('hr')
  @Post('invite')
  invite(@Body() userDto: InviteDto) {
    return this.hrService.invite(userDto);
  }
}
