import {
  Controller,
  Get,
  Body,
  UseGuards,
  Req,
  UnauthorizedException,
  Param,
  ParseIntPipe,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import type { Request } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PoliciesGuard } from 'src/common/guards/policies.guard';
import { CheckPolicies } from 'src/common/decorators/policy.decorator';
import { Action } from 'src/common/enums/action.enum';
import { User } from './entities/user.entity';
import { CaslAbilityFactory } from '../casl/casl-ability.factory';
import { ForbiddenError } from '@casl/ability';
import { ActiveUser } from 'src/common/interfaces/active-user.interface';
import type { RequestWithUser } from 'src/common/interfaces/request-with-user.interface';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly caslAbilityFactory: CaslAbilityFactory,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('/me')
  @ApiOperation({ summary: 'Thông tin người đang đăng nhập' })
  @ApiBearerAuth()
  getMe(@Req() req: RequestWithUser) {
    if (!req.user) {
      throw new UnauthorizedException();
    }
    return this.usersService.getMe(req.user.userId);
  }

  @UseGuards(JwtAuthGuard, PoliciesGuard)
  @CheckPolicies((ability) => ability.can(Action.Read, User))
  @Get(':id')
  @ApiOperation({
    summary: '[CASL Demo] Xem user theo ID - Kiểm tra quyền ABAC',
  })
  @ApiBearerAuth()
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
  ) {
    const userToRead = await this.usersService.findOneEntity(id);
    // Sử dụng userEntity đã được PoliciesGuard fetch sẵn
    if (!req.userEntity) {
      throw new UnauthorizedException();
    }
    const ability = this.caslAbilityFactory.createForUser(req.userEntity);

    try {
      ForbiddenError.from(ability).throwUnlessCan(Action.Read, userToRead);
      return this.usersService.toResponse(userToRead);
    } catch (error) {
      throw new ForbiddenException('Bạn không có quyền xem thông tin này');
    }
  }
}
