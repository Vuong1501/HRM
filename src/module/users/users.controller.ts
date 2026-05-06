import {
  Controller,
  Get,
  Body,
  UseGuards,
  Req,
  Query,
  UnauthorizedException,
  Param,
  ParseIntPipe,
  ForbiddenException,
  Patch,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import type { Request } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PoliciesGuard } from 'src/common/guards/policies.guard';
import { CheckPolicies } from 'src/common/decorators/policy.decorator';
import { Action } from 'src/common/enums/action.enum';
import { User } from './entities/user.entity';
import { CaslAbilityFactory } from '../casl/casl-ability.factory';
import { ForbiddenError } from '@casl/ability';
import { ActiveUser } from 'src/common/interfaces/active-user.interface';
import type { RequestWithUser } from 'src/common/interfaces/request-with-user.interface';
import { APP_ERRORS } from 'src/common/errors/app.errors';
import { EmployeeListQueryDto } from './dto/employee-list-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';

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
      throw new UnauthorizedException(APP_ERRORS.UNAUTHORIZED);
    }
    return this.usersService.getMe(req.user.userId);
  }

  @UseGuards(JwtAuthGuard, PoliciesGuard)
  @CheckPolicies((ability) => ability.can(Action.Read, User))
  @Get('/employees')
  @ApiOperation({ summary: 'Lấy danh sách nhân viên để chọn (dành cho tạo OT)' })
  @ApiQuery({ name: 'search', required: false, description: 'Tìm kiếm theo tên nhân viên' })
  @ApiBearerAuth()
  getEmployeesList(
    @Req() req: RequestWithUser,
    @Query('search') search?: string,
  ) {
    if (!req.user) {
      throw new UnauthorizedException(APP_ERRORS.UNAUTHORIZED);
    }
    return this.usersService.getEmployeesList(req.user.userId, search);
  }

  // [HR] Lấy danh sách toàn bộ nhân viên công ty
  @UseGuards(JwtAuthGuard, PoliciesGuard)
  @CheckPolicies((ability) => ability.can(Action.Manage, User))
  @Get('/company-employees')
  @ApiOperation({ summary: '[HR/Admin] Lấy danh sách nhân viên toàn công ty' })
  @ApiQuery({ name: 'search', required: false, description: 'Tìm kiếm theo tên hoặc email' })
  @ApiQuery({ name: 'departmentName', required: false, description: 'Lọc theo phòng ban' })
  @ApiQuery({ name: 'page', required: false, description: 'Trang (mặc định: 1)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Số bản ghi mỗi trang (mặc định: 10)' })
  @ApiBearerAuth()
  getCompanyEmployees(
    @Query() query: EmployeeListQueryDto,
  ) {
    return this.usersService.getCompanyEmployees(query);
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
    if (!req.userEntity) {
      throw new UnauthorizedException(APP_ERRORS.UNAUTHORIZED);
    }
    const ability = this.caslAbilityFactory.createForUser(req.userEntity);

    try {
      ForbiddenError.from(ability).throwUnlessCan(Action.Read, userToRead);
      return this.usersService.toResponse(userToRead);
    } catch (error) {
      throw new ForbiddenException(APP_ERRORS.VIEW_USER_FORBIDDEN);
    }
  }

  @Patch(':id')
  @CheckPolicies((ability) => ability.can(Action.Update, User))
  updateUser(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.updateUser(Number(id), dto);
  }

  @Patch(':id/inactive')
  @UseGuards(JwtAuthGuard, PoliciesGuard)
  @CheckPolicies((ability) => ability.can(Action.Update, User))
  inactiveUser(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.inactiveUser(id);
  }
}
