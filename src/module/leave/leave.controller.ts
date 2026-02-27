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
import { diskStorage } from 'multer';
import { extname } from 'path';

@Controller('leave')
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class LeaveController {
  constructor(private readonly leaveService: LeaveService) {}

  @Post('request')
  @CheckPolicies((ability) =>
  ability.can(Action.Create, LeaveRequest))
  @UseInterceptors(
    FilesInterceptor('attachments', 5, {
      storage: diskStorage({
        destination: './uploads/leave',
        filename: (req, file, cb) => {
          const uniqueName =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, uniqueName + extname(file.originalname));
        },
      }),

      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },

      fileFilter: (req, file, cb) => {
        const allowedTypes = [
          'application/pdf',
          'image/jpeg',
          'image/png',
        ];
        const allowedExtensions = ['.pdf', '.png', '.jpg', '.jpeg'];
        const ext = extname(file.originalname).toLowerCase();

        if (!allowedTypes.includes(file.mimetype) || !allowedExtensions.includes(ext)) {
          return cb(
            new BadRequestException(
              'Chỉ cho phép file PDF, PNG, JPG, JPEG',
            ),
            false,
          );
        }

        cb(null, true);
      },
    }),
  )
  createLeaveRequest(
    @Req() req: RequestWithUser,
    @Body() dto: CreateLeaveRequestDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.leaveService.createLeaveRequest(req.user.userId, dto, files);
  }

  /**
   * Xem danh sách đơn nghỉ của mình
   * GET /leave/my-requests
   */
  @Get('my-requests')
  getMyRequests(@Req() req: RequestWithUser) {
    return this.leaveService.getMyLeaveRequests(req.user.userId);
  }

  /**
   * Xem số phép còn lại
   * GET /leave/my-balance
   */
  @Get('my-balance')
  getMyBalance(@Req() req: RequestWithUser) {
    return this.leaveService.getMyBalance(req.user.userId);
  }

  /**
   * Department Lead / Admin: Xem đơn chờ duyệt
   * GET /leave/pending
   */
  @Get('pending')
  getPendingRequests(@Req() req: RequestWithUser) {
    return this.leaveService.getPendingRequests(req.user.userId);
  }

  /**
   * Department Lead / Admin: Duyệt đơn
   * PATCH /leave/:id/approve
   */
  // @Patch(':id/approve')
  // approveRequest(
  //   @Req() req: RequestWithUser,
  //   @Param('id', ParseIntPipe) id: number,
  // ) {
  //   return this.leaveService.approveLeaveRequest(req.user.userId, id);
  // }

  /**
   * Department Lead / Admin: Từ chối đơn
   * PATCH /leave/:id/reject
   */
  @Patch(':id/reject')
  rejectRequest(
    @Req() req: RequestWithUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RejectLeaveDto,
  ) {
    return this.leaveService.rejectLeaveRequest(req.user.userId, id, dto);
  }

  /**
   * Employee tự hủy đơn nghỉ
   * PATCH /leave/:id/cancel
   */
  @Patch(':id/cancel')
  cancelRequest(
    @Req() req: RequestWithUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.leaveService.cancelLeaveRequest(req.user.userId, id);
  }
}
