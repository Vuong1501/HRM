import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  ParseIntPipe,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
  Query,
  Res,
} from '@nestjs/common';
import { LeaveService } from './leave.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { RejectLeaveDto } from './dto/reject-leave.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import type { RequestWithUser } from 'src/common/interfaces/request-with-user.interface';
import { PoliciesGuard } from 'src/common/guards/policies.guard';
import { CheckPolicies } from 'src/common/decorators/policy.decorator';
import { LeaveRequest } from './entities/leave-request.entity';
import { Action } from 'src/common/enums/action.enum';
import { FilesInterceptor } from '@nestjs/platform-express';
import { LeaveListQueryDto } from './dto/leave-list-query.dto';
import { ApproveLeaveDto } from './dto/approve-leave.dto';
import type  { Response } from 'express';
import { UpdateLeaveRequestDto } from './dto/update-leave-request.dto';
import { CancelLeaveRequestDto } from './dto/cancel-leave-request.dto';
import { leaveUploadOptions, MAX_FILES  } from 'src/common/multer/leave-upload.config';
import dayjs from 'dayjs';
import { AnnualSummaryQueryDto } from './dto/annual-summary-query.dto';
import { MonthYearQueryMyDto } from './dto/moth-year-query-my.dto';
import { MonthYearQueryHRDto } from './dto/moth-year-query-hr.dto';

@Controller('leave')
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class LeaveController {
  constructor(private readonly leaveService: LeaveService) {}

  // tạo đơn nghỉ
  @Post('request')
  @CheckPolicies((ability) =>
  ability.can(Action.Create, LeaveRequest))
  @UseInterceptors(FilesInterceptor('attachments', MAX_FILES, leaveUploadOptions))
  createLeaveRequest(
    @Req() req: RequestWithUser,
    @Body() dto: CreateLeaveRequestDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.leaveService.createLeaveRequest(req.user.userId, dto, files);
  }

  // danh sách đơn nghỉ của mình
  @Get('my-requests')
  @CheckPolicies((ability) =>
    ability.can(Action.Read, LeaveRequest))
  getListMyLeaveRequests(
    @Req() req: RequestWithUser,
    @Query() query: LeaveListQueryDto
  ) {
    return this.leaveService.getListMyLeaveRequests(req.userEntity, query);
  }

  /**
   * Xem số phép còn lại
   * GET /leave/my-balance
   */
  @Get('my-balance')
  getMyBalance(@Req() req: RequestWithUser) {
    return this.leaveService.getMyBalance(req.user.userId);
  }

  // lấy danh sách đơn nghỉ của phòng ban
  @Get('list-requests')
  @CheckPolicies((ability) =>
    ability.can(Action.Read, LeaveRequest))
  getListRequests(
    @Req() req: RequestWithUser,
    @Query() query: LeaveListQueryDto
  ) {
    return this.leaveService.getListRequests(req.userEntity, query);
  }

  // api hr xem list đơn nghỉ được chấp nhận của cả cty (màn hình report)
  @Get('report/approved')
  @CheckPolicies((ability) =>
    ability.can(Action.ViewReport, LeaveRequest))
  getApprovedLeaveReport(
    @Req() req: RequestWithUser,
    @Query() query: LeaveListQueryDto,
  ) {
    return this.leaveService.getApprovedLeaveReport(req.userEntity, query);
  }

  // api hr xem thống kê nghỉ dùng phép năm của toàn công ty (màn report)
  @Get('report/summary')
  @CheckPolicies((ability) => ability.can(Action.ViewReport, LeaveRequest))
  getReportSummary(
    @Query() query: AnnualSummaryQueryDto
  ) { 
    return this.leaveService.getReportSummary(query);
  }

  // api hr xem thống kê nghỉ theo năm/tháng của cả cty(màn report)
  @Get('report/summary-monthly')
  @CheckPolicies((ability) => ability.can(Action.ViewReport, LeaveRequest))
  getSummaryMonthlyHR(
    @Query() query: MonthYearQueryHRDto
  ) { 
    return this.leaveService.getSummaryMonthlyHR(query);
  }

  // lead_dep, admin duyệt đơn nghỉ
  @Patch(':id/approve')
  @CheckPolicies((ability) =>
    ability.can(Action.Approve, LeaveRequest))
  approveRequest(
    @Req() req: RequestWithUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ApproveLeaveDto,
  ) {
    return this.leaveService.approveLeaveRequest(req.user.userId, id, dto);
  }

  // Department Lead / Admin: Từ chối đơn
  @Patch(':id/reject')
  @CheckPolicies((ability) =>
    ability.can(Action.Reject, LeaveRequest))
  rejectRequest(
    @Req() req: RequestWithUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RejectLeaveDto,
  ) {
    return this.leaveService.rejectLeaveRequest(req.user.userId, id, dto);
  }

  // Employee tự hủy đơn nghỉ
  @Patch(':id/cancel')
  @CheckPolicies((ability) =>
    ability.can(Action.Cancel, LeaveRequest))
  cancelRequest(
    @Req() req: RequestWithUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelLeaveRequestDto,
  ) {
    return this.leaveService.cancelLeaveRequest(req.user.userId, id, dto);
  }

  // xem chi tiết đơn xin nghỉ
  @Get('detail-leave/:id')
  @CheckPolicies((ability) =>
    ability.can(Action.Read, LeaveRequest))
  getLeaveRequest(
    @Req() req: RequestWithUser,
    @Param('id', ParseIntPipe) id: number
  ) {
    return this.leaveService.leaveRequestDetail(req.userEntity, id);
  }

  //xem file đính kèm
  @Get('attachments/:id')
  @CheckPolicies((ability) =>
    ability.can(Action.Read, LeaveRequest))
  getLeaveRequestAttachments(
    @Req() req: RequestWithUser,
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    return this.leaveService.getLeaveRequestAttachments(req.userEntity, id, res);
  } 

  // cập nhật đơn nghỉ
  @Patch(':id/update')
  @CheckPolicies((ability) =>
    ability.can(Action.Update, LeaveRequest))
  @UseInterceptors(FilesInterceptor('attachments', MAX_FILES, leaveUploadOptions))
  updateRequest(
    @Req() req: RequestWithUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateLeaveRequestDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.leaveService.updateLeaveRequest(req.userEntity, id, dto, files);
  }

  // api thống kê nghỉ của bản thân
  @Get('my-summary')
  @CheckPolicies((ability) =>
    ability.can(Action.Read, LeaveRequest))
  getMySummary(
    @Req() req: RequestWithUser,
    @Query('year') year?: string,
  ) {
    return this.leaveService.getMySummary(
      req.userEntity.id,
      Number(year) || dayjs().year()
    );
  }

  // api thống kê nghỉ của tháng/năm
  @Get('my-calendar')
  @CheckPolicies((ability) => ability.can(Action.Read, LeaveRequest))
  getMyCalendar(
    @Req() req: RequestWithUser,
    @Query() query: MonthYearQueryMyDto
  ) {
      const now = dayjs();
      return this.leaveService.getMyCalendar(
          req.userEntity.id,
          query.month || now.month() + 1,
          query.year || now.year(),
      );
  }
  
}
