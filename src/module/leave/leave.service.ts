import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, In } from 'typeorm';
import { Response } from 'express';
import { LeaveRequest } from './entities/leave-request.entity';
import { LeaveBalance } from './entities/leave-balance.entity';
import { LeaveConfig } from './entities/leave-config.entity';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { RejectLeaveDto } from './dto/reject-leave.dto';
import { ApproveLeaveDto } from './dto/approve-leave.dto';
import { LeaveRequestStatus } from 'src/common/enums/leave-request-status.enum';
import { LeaveType } from 'src/common/enums/leave-type.enum';
import { User } from '../users/entities/user.entity';
import { UserRole } from 'src/common/enums/user-role.enum';
import { HalfDayType } from 'src/common/enums/halfDayType.enum';
import { EmploymentType } from 'src/common/enums/user-employeeType.enum';
import { LeaveAccrualService } from './leave-accrual.service';
import { MailService } from '../mail/mail.service';
import { DataSource } from 'typeorm';
import { LeaveAttachment } from './entities/leave_attachments.entity';
import { LeaveRequestQueryBuilder } from './leave-request.query-builder';
import { LeaveListQueryDto } from './dto/leave-list-query.dto';
import { UpdateLeaveRequestDto } from './dto/update-leave-request.dto';
import { CancelLeaveRequestDto } from './dto/cancel-leave-request.dto';
import { StorageService } from 'src/common/storage/storage.service';
import { LEAVE_ERRORS } from './leave.errors';
import { LEAVE_CONSTANTS } from 'src/common/constants/leave.constants';
import { EMPLOYEE_LIKE_ROLES } from 'src/common/constants/role-groups.constant';
import dayjs from 'dayjs';

@Injectable()
export class LeaveService {
  constructor(
    @InjectRepository(LeaveRequest)
    private leaveRequestRepo: Repository<LeaveRequest>,

    @InjectRepository(LeaveBalance)
    private leaveBalanceRepo: Repository<LeaveBalance>,

    @InjectRepository(User)
    private userRepo: Repository<User>,

    @InjectRepository(LeaveConfig)
    private leaveConfigRepo: Repository<LeaveConfig>,

    @InjectRepository(LeaveAttachment)
    private leaveAttachmentRepo: Repository<LeaveAttachment>,

    private readonly queryBuilder: LeaveRequestQueryBuilder,
    private leaveAccrualService: LeaveAccrualService,
    private mailService: MailService,
    private dataSource: DataSource,
    private storageService: StorageService
  ) {}

  async getLeaveList(user: User, query: LeaveListQueryDto, isSelf = false) {
    const { page = 1, limit = 10 } = query;

    let qb = this.queryBuilder.buildBaseQuery();

    qb = this.queryBuilder.applyAuthorization(qb, user, isSelf);
    qb = this.queryBuilder.applyFilters(qb, query);

    // query đếm tổng trước
    const total = await qb.getCount();

    //query lấy dữ liệu
    const dataQb = qb.clone()

    dataQb.select([
      'lr.id AS id',
      'lr.userId AS userId',
      'lr.leaveType AS leaveType',
      'lr.leaveSubType AS leaveSubType',
      'lr.startHalfDayType AS startHalfDayType',
      'lr.endHalfDayType AS endHalfDayType',
      'lr.status AS status',
      'lr.startDate AS startDate',
      'lr.endDate AS endDate',
      'lr.reason AS reason',
      'lr.createdAt AS createdAt',
      'user.name AS employeeName',
      'user.departmentName AS department',
      'approver.name AS approverName',
      'lr.approvedAt AS approvedAt',
      'lr.rejectionReason AS rejectionReason',
      'lr.cancelReason AS cancelReason',
    ])
    .orderBy('lr.createdAt', 'DESC')
    .offset((page - 1) * limit)
    .limit(limit);

    const rawData = await dataQb.getRawMany();

    const data = rawData.map((item) => ({
      id: item.id,
      userId: item.userId,
      leaveType: item.leaveType,
      leaveSubType: item.leaveSubType,
      startHalfDayType: item.startHalfDayType,
      endHalfDayType: item.endHalfDayType,
      status: item.status,
      startDate: item.startDate,
      endDate: item.endDate,
      reason: item.reason,
      createdAt: item.createdAt,
      user: {
        name: item.employeeName,
        departmentName: item.department,
      },
      approver: item.approverName ? { name: item.approverName } : null,
      approvedAt: item.approvedAt,
      rejectionReason: item.rejectionReason,
      cancelReason: item.cancelReason,
    }));

    return {
      data,
      total,
      page,
      lastPage: Math.ceil(total / limit),
    };
  }

  //Tạo đơn xin nghỉ
  async createLeaveRequest(userId: number, dto: CreateLeaveRequestDto, files: Express.Multer.File[]) {

    // Validate sơ bộ Logic của các loại Phép có kèm lý do hay không
    this.validateLeaveSubType(dto.leaveType, dto.leaveSubType);

    // nghỉ bảo hiểm bắt buộc có file đính kèm
    if (dto.leaveType === LeaveType.INSURANCE && (!files || files.length === 0)) {
      throw new BadRequestException(LEAVE_ERRORS.INSURANCE_REQUIRES_ATTACHMENT);
    }

    //Tìm user
    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user) throw new NotFoundException(LEAVE_ERRORS.EMPLOYEE_NOT_FOUND);

    // kiểm tra type nhân viên
    if (
      (dto.leaveType === LeaveType.PAID || dto.leaveType === LeaveType.INSURANCE) &&
      user.employmentType !== EmploymentType.OFFICIAL
    ) {
      throw new ForbiddenException(LEAVE_ERRORS.NOT_OFFICIAL_EMPLOYEE);
    }

    const startDate = dayjs(dto.startDate).startOf('day');
    const endDate = dayjs(dto.endDate).endOf('day');
    const today = dayjs().startOf('day');

    // kiểm tra ngày bắt đầu và kết thúc
    if (startDate.isAfter(endDate)) {
      throw new BadRequestException(LEAVE_ERRORS.INVALID_DATE_RANGE);
    }

    if (startDate.isSame(endDate) && dto.startHalfDayType === HalfDayType.AFTERNOON && dto.endHalfDayType === HalfDayType.MORNING) {
      throw new BadRequestException(LEAVE_ERRORS.INVALID_HALF_DAY);
    }
    if (startDate.isBefore(today, 'day')) {
      if (
        startDate.month() !== today.month() ||
        startDate.year() !== today.year()
      ) {
        throw new BadRequestException(LEAVE_ERRORS.PAST_DATE_NOT_ALLOWED);
      }
    }
    //gọi hàm kiểm nếu trùng ngày thì lặp qua từng ngày xem có bị trùng buổi nào không
    await this.checkScheduleConflict(
      userId,
      startDate,
      endDate,
      dto.startHalfDayType,
      dto.endHalfDayType,
    );

    // Tính số ngày nghỉ
    const leaveDays = this.calculateLeaveDays(startDate.toDate(), endDate.toDate(), dto.startHalfDayType, dto.endHalfDayType);
    const currentYear = today.year();

    // Lấy hoặc tạo quỹ nghỉ
    let balance = await this.getOrCreateBalance(userId, currentYear);

    // Validate theo loại nghỉ
    let compensatoryInfo: { balance: number; warning?: string} | undefined;

    // gọi hàm kiểm tra ngày nghỉ rồi gán vào 2 biến
    const { paidDeduction, unpaidDeduction } = await this.validateLeaveQuota(
      dto.leaveType,
      dto.leaveSubType ?? null,
      userId,
      leaveDays,
      balance,
      startDate,
    );

    const lead = await this.userRepo.findOne({
      where : {
        departmentName: user.departmentName,
        role: UserRole.DEPARTMENT_LEAD
      }
    });

    // Upload lên MinIO trước
    let uploadedFilesData: { file: Express.Multer.File; fileKey: string }[] = [];
    if (files && files.length > 0) {
      uploadedFilesData = await Promise.all(
        files.map(async (file) => {
          const fileKey = await this.storageService.uploadFile(file, 'leave');
          return { file, fileKey };
        })
      );
    }

    // bắt đầu transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const leaveRequest = queryRunner.manager.create(LeaveRequest, {
        userId,
        leaveType: dto.leaveType,
        leaveSubType: dto.leaveSubType || null,
        startDate: startDate.toDate(),
        endDate: endDate.toDate(),
        startHalfDayType: dto.startHalfDayType,
        endHalfDayType: dto.endHalfDayType,
        reason: dto.reason,
        paidLeaveDeduction: paidDeduction,
        unpaidLeaveDeduction: unpaidDeduction,
        status: LeaveRequestStatus.PENDING
      });
      const savedLeave = await queryRunner.manager.save(leaveRequest);

      // lưu file đã tải lên mảng ở trên
      if (uploadedFilesData.length > 0) {
        const attachments = uploadedFilesData.map((data) => {
          return queryRunner.manager.create(LeaveAttachment, {
            leaveRequestId: savedLeave.id,
            originalName: Buffer.from(data.file.originalname, 'latin1').toString('utf8'),
            fileKey: data.fileKey,          
            size: data.file.size,
            mimeType: data.file.mimetype,
          });
        });
        await queryRunner.manager.save(LeaveAttachment, attachments);
      }

      await queryRunner.commitTransaction();

      if(lead){
        this.mailService.sendMailWithRetry(
          () => this.mailService.sendLeaveRequestNotification(
            lead.email,
            user.name,
            user.departmentName,
            startDate.toDate(),
            endDate.toDate(),
          ),
          'SEND_LEAVE_NOTIFICATION_FAILED',
        ).catch(e => console.error(`Lỗi gửi mail thông báo nghỉ phép cho Lead`, e));
      }
      
      return {
        message: 'Tạo đơn xin nghỉ thành công',
        data: savedLeave,
        leaveDays,
        breakdown: {
          inQuota: (dto.leaveType === LeaveType.PERSONAL_PAID || dto.leaveType === LeaveType.INSURANCE) ? leaveDays : 0,
          paidDeduction,
          unpaidDeduction,
        },
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (uploadedFilesData.length > 0) {
        Promise.all(
          uploadedFilesData.map((data) => this.storageService.deleteFile(data.fileKey).catch(() => {}))
        );
      }
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
  // lấy đơn xin nghỉ của mình
  async getListMyLeaveRequests(user: User, query: LeaveListQueryDto) {
    return this.getLeaveList(user, query, true);
  }

  /**
   * Xem số phép còn lại
   */
  async getMyBalance(userId: number) {
    const currentYear = dayjs().year();
    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user) throw new NotFoundException(LEAVE_ERRORS.EMPLOYEE_NOT_FOUND);

    const balance = await this.getOrCreateBalance(userId, currentYear);
    const annualRemaining =
      Number(balance.annualLeaveTotal) - Number(balance.annualLeaveUsed);

    return {
      year: currentYear,
      annualLeaveTotal: Number(balance.annualLeaveTotal),
      annualLeaveUsed: Number(balance.annualLeaveUsed),
      annualLeaveRemaining: annualRemaining,
      unpaidLeaveUsed: Number(balance.unpaidLeaveUsed),
      compensatoryBalance: Number(balance.compensatoryBalance),
    };
  }

  // lấy danh sách đơn nghỉ của phòng ban của mình
  async getListRequests(user: User, query: LeaveListQueryDto) {
    return this.getLeaveList(user, query, false);
  }

  // HR xem danh sách đơn đã được APPROVED (dùng cho màn hình report)
  async getApprovedLeaveReport(user: User, query: LeaveListQueryDto) {
    if (user.role !== UserRole.HR) {
      throw new ForbiddenException('Chỉ HR mới có quyền xem báo cáo này');
    }

    const { page = 1, limit = 10 } = query;

    let qb = this.queryBuilder.buildBaseQuery();
    qb = this.queryBuilder.applyHRReportAuthorization(qb, user);
    qb = this.queryBuilder.applyFilters(qb, query);

    const total = await qb.getCount();

    const dataQb = qb.clone();
    dataQb.select([
      'lr.id AS id',
      'lr.userId AS userId',
      'lr.leaveType AS leaveType',
      'lr.leaveSubType AS leaveSubType',
      'lr.startHalfDayType AS startHalfDayType',
      'lr.endHalfDayType AS endHalfDayType',
      'lr.status AS status',
      'lr.startDate AS startDate',
      'lr.endDate AS endDate',
      'lr.reason AS reason',
      'lr.createdAt AS createdAt',
      'user.name AS employeeName',
      'user.departmentName AS department',
      'approver.name AS approverName',
      'lr.approvedAt AS approvedAt',
    ])
    .orderBy('lr.approvedAt', 'DESC')
    .offset((page - 1) * limit)
    .limit(limit);

    const rawData = await dataQb.getRawMany();

    const data = rawData.map((item) => ({
      id: item.id,
      userId: item.userId,
      leaveType: item.leaveType,
      leaveSubType: item.leaveSubType,
      startHalfDayType: item.startHalfDayType,
      endHalfDayType: item.endHalfDayType,
      status: item.status,
      startDate: item.startDate,
      endDate: item.endDate,
      reason: item.reason,
      createdAt: item.createdAt,
      approvedAt: item.approvedAt,
      user: {
        name: item.employeeName,
        departmentName: item.department,
      },
      approver: item.approverName ? { name: item.approverName } : null,
    }));

    return {
      data,
      total,
      page,
      lastPage: Math.ceil(total / limit),
    };
  }

  // duyệt đơn nghỉ
  async approveLeaveRequest(userId: number, requestId: number, dto: ApproveLeaveDto) {

    // lấy ra đơn nghỉ
    const leave = await this.leaveRequestRepo.findOne({
      where: { id: requestId },
      relations: ['user'],
    });
    if (!leave) throw new NotFoundException(LEAVE_ERRORS.LEAVE_NOT_FOUND);

    //lấy ra id người đang đăng nhập để kiểm tra quyền 
    const user = await this.userRepo.findOneBy({id: userId})
    if (!user) throw new NotFoundException(LEAVE_ERRORS.APPROVER_NOT_FOUND);
    // Lead & HR: Chỉ duyệt đơn của nhân viên cùng phòng ban
    if (
      (user.role === UserRole.DEPARTMENT_LEAD || user.role === UserRole.HR) &&
      leave.user.departmentName !== user.departmentName
    ) {
      throw new ForbiddenException(LEAVE_ERRORS.APPROVE_OWN_DEPARTMENT_ONLY);
    }

    // lấy hoặc tạo balance
    const currentYear = dayjs().year();
    const balance = await this.getOrCreateBalance(leave.userId, currentYear);
    let warning: string | undefined;
    if((leave.leaveType === LeaveType.UNPAID) && Number(balance.unpaidLeaveUsed) >= LEAVE_CONSTANTS.MAX_UNPAID_LEAVES_PER_YEAR) {
        warning = `Nhân viên này đã nghỉ không lương ${balance.unpaidLeaveUsed} ngày trong năm nay.`;
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. ATOMIC UPDATE Bảng Cha
      // Optimistic locking chuẩn: so sánh version (số nguyên), không có precision mismatch
      if (dto.version !== undefined && leave.version !== dto.version) {
        throw new ConflictException(LEAVE_ERRORS.LEAVE_MODIFIED);
      }

      const updateResult = await queryRunner.manager.update(
        LeaveRequest,
        { 
          id: requestId, 
          status: LeaveRequestStatus.PENDING, 
        },
        {
          status: LeaveRequestStatus.APPROVED,
          approverId: user.id,
          approvedAt: dayjs().toDate(),
        }
      );

      if (updateResult.affected === 0) {
        throw new BadRequestException(LEAVE_ERRORS.CANNOT_APPROVE);
      }

      // Chỉnh sửa bảng con (Quỹ phép)
      const startDate = dayjs(leave.startDate).startOf('day');
      const endDate = dayjs(leave.endDate).startOf('day');
      if (leave.leaveType === LeaveType.COMPENSATORY) {
        const leaveDays = this.calculateLeaveDays(
          startDate.toDate(),
          endDate.toDate(),
          leave.startHalfDayType,
          leave.endHalfDayType,
        );

        balance.compensatoryBalance =
          Number(balance.compensatoryBalance) - leaveDays * LEAVE_CONSTANTS.HOURS_PER_DAY;
      } else {
        balance.annualLeaveUsed =
          Number(balance.annualLeaveUsed) +
          Number(leave.paidLeaveDeduction);

        balance.unpaidLeaveUsed =
          Number(balance.unpaidLeaveUsed) +
          Number(leave.unpaidLeaveDeduction); 
      }

      await queryRunner.manager.save(LeaveBalance, balance);
      await queryRunner.commitTransaction();

      //Gửi mail 
      const hrs = await this.userRepo.find({
        where: { role: UserRole.HR },
      });

      Promise.all(
        hrs.map((hr) =>
          this.mailService.sendMailWithRetry(
            () => this.mailService.sendLeaveApprovedNotification(
              hr.email,
              leave.user.name,
              startDate.toDate(),
              endDate.toDate(),
            ),
            'SEND_LEAVE_APPROVED_FAILED',
          ).catch(e => console.error(`Lỗi gửi mail HR (${hr.email}) duyệt nghỉ của ${leave.user.email}`, e))
        ),
      );

      return {
        message: 'Duyệt đơn nghỉ thành công',
        ...(warning && { warning }),
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  //Từ chối đơn nghỉ
  async rejectLeaveRequest(
    userId: number,
    requestId: number,
    dto: RejectLeaveDto,
  ) {
    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user) throw new NotFoundException(LEAVE_ERRORS.APPROVER_NOT_FOUND);

    const leave = await this.leaveRequestRepo.findOne({
      where: { id: requestId },
      relations: ['user'],
    });
    if (!leave) throw new NotFoundException(LEAVE_ERRORS.LEAVE_NOT_FOUND);
    // Lead & HR: Chỉ từ chối đơn của nhân viên cùng phòng ban
    if (
      (user.role === UserRole.DEPARTMENT_LEAD || user.role === UserRole.HR) &&
      leave.user.departmentName !== user.departmentName
    ) {
      throw new ForbiddenException(LEAVE_ERRORS.REJECT_OWN_DEPARTMENT_ONLY);
    }

    // Optimistic locking chuẩn: so sánh version
    if (dto.version !== undefined && leave.version !== dto.version) {
      throw new ConflictException(LEAVE_ERRORS.LEAVE_MODIFIED);
    }

    // update atomic
    const updateResult = await this.leaveRequestRepo.update(
        { 
          id: requestId, 
          status: LeaveRequestStatus.PENDING,
        },
        {
            status: LeaveRequestStatus.REJECTED,
            rejectionReason: dto.rejectionReason,
            approverId: userId,
        }
    );

    if (updateResult.affected === 0) {
      throw new BadRequestException(LEAVE_ERRORS.NOT_PENDING_STATUS);
    }

    return {
      message: 'Từ chối đơn xin nghỉ thành công'
    };
  }

  // Nhân viên tự hủy đơn nghỉ
  async cancelLeaveRequest(userId: number, requestId: number, dto: CancelLeaveRequestDto) {

    const leaveRequest = await this.leaveRequestRepo.findOne({
      where: { id: requestId },
      relations: ['attachments'], // để xóa file đính kèm nếu có
    });

    if (!leaveRequest) throw new NotFoundException(LEAVE_ERRORS.LEAVE_NOT_FOUND);
    if (leaveRequest.userId !== userId) {
      throw new ForbiddenException(LEAVE_ERRORS.CANCEL_OWN_ONLY);
    }

    if (
      leaveRequest.status !== LeaveRequestStatus.PENDING &&
      leaveRequest.status !== LeaveRequestStatus.APPROVED
    ) {
      throw new BadRequestException(LEAVE_ERRORS.CANNOT_CANCEL);
    }

    if (leaveRequest.status === LeaveRequestStatus.APPROVED && !dto.cancelReason?.trim()) {
      throw new BadRequestException(LEAVE_ERRORS.CANCEL_REASON_REQUIRED);
    }

    const currentYear = dayjs().year();
    const balance = leaveRequest.status === LeaveRequestStatus.APPROVED
      ? await this.getOrCreateBalance(leaveRequest.userId, currentYear)
      : null;
    // bắt đầu transaction
    const result = await this.dataSource.transaction(async (manager) => {

      if (leaveRequest.status === LeaveRequestStatus.APPROVED && balance) {
        const startDate = dayjs(leaveRequest.startDate).startOf('day');
        const endDate = dayjs(leaveRequest.endDate).startOf('day');
        if (leaveRequest.leaveType === LeaveType.COMPENSATORY) {
          const leaveDays = this.calculateLeaveDays(
            startDate.toDate(),
            endDate.toDate(),
            leaveRequest.startHalfDayType,
            leaveRequest.endHalfDayType,
          );
          // Hoàn trả giờ bù
          balance.compensatoryBalance = Number(balance.compensatoryBalance) + leaveDays * LEAVE_CONSTANTS.HOURS_PER_DAY;
        } else {
          // Hoàn trả phép năm và không lương 
          balance.annualLeaveUsed = Number(balance.annualLeaveUsed) - Number(leaveRequest.paidLeaveDeduction);
          balance.unpaidLeaveUsed = Number(balance.unpaidLeaveUsed) - Number(leaveRequest.unpaidLeaveDeduction);
        }
        await manager.save(balance);
      }

      // Xóa trong bảng DB
      if (leaveRequest.attachments?.length > 0) {
        await manager.delete(LeaveAttachment, { leaveRequestId: leaveRequest.id });
      }

      leaveRequest.status = LeaveRequestStatus.CANCELLED;
      leaveRequest.cancelReason = dto.cancelReason ?? null;
      leaveRequest.paidLeaveDeduction = 0;
      leaveRequest.unpaidLeaveDeduction = 0;
      await manager.save(leaveRequest);

      return {
        message: 'Đã hủy đơn nghỉ'
      };
    });

    // Chỉ khi transaction OK, mới kích hoạt xoá file trên MinIO
    if (leaveRequest.attachments?.length > 0) {
      Promise.all(
        leaveRequest.attachments.map((att) =>
          this.storageService.deleteFile(att.fileKey).catch(() => {}),
        ),
      );
    }

    return result;
  }

  //cập nhật đơn xin nghỉ
  async updateLeaveRequest(
    user: User, 
    requestId: number, 
    dto: UpdateLeaveRequestDto,
    files: Express.Multer.File[],
  ) {

    const leave = await this.leaveRequestRepo.findOne({
      where: { id: requestId },
      relations: ['user', 'attachments'],
    });
    if (!leave) throw new NotFoundException(LEAVE_ERRORS.LEAVE_NOT_FOUND);

    if (
      EMPLOYEE_LIKE_ROLES.includes(user.role) &&
      leave.userId !== user.id
    ) {
      throw new ForbiddenException(LEAVE_ERRORS.ONLY_UPDATE_OWN);
    }

    if (leave.status !== LeaveRequestStatus.PENDING) {
      throw new BadRequestException(LEAVE_ERRORS.ONLY_UPDATE_PENDING);
    }
    if (!dayjs(leave.updatedAt).isSame(dayjs(dto.clientUpdatedAt))) {
      throw new ConflictException(LEAVE_ERRORS.LEAVE_MODIFIED);
    }
    const { clientUpdatedAt, ...updateData } = dto;
    Object.assign(leave, updateData);

    // Kiểm tra tính hợp lệ của Sự ghép cặp Loại Phép - Lý do Phép
    this.validateLeaveSubType(leave.leaveType, leave.leaveSubType);

    const startDate = dayjs(leave.startDate).startOf('day');
    const endDate = dayjs(leave.endDate).startOf('day');

    //  Validate ngày
    if (startDate.isAfter(endDate)) {
      throw new BadRequestException(LEAVE_ERRORS.INVALID_DATE_RANGE);
    }

    if (
      startDate.isSame(endDate, 'day') &&
      leave.startHalfDayType === HalfDayType.AFTERNOON &&
      leave.endHalfDayType === HalfDayType.MORNING
    ) {
      throw new BadRequestException(LEAVE_ERRORS.INVALID_HALF_DAY);
    }
    //  Check trùng lịch (loại trừ chính nó)
    await this.checkScheduleConflict(
      leave.userId,
      startDate,
      endDate,
      leave.startHalfDayType,
      leave.endHalfDayType,
      requestId,
    );

    //  Tính số ngày nghỉ
    const leaveDays = this.calculateLeaveDays(
      startDate.toDate(),
      endDate.toDate(),
      leave.startHalfDayType,
      leave.endHalfDayType,
    );

    //  Lấy balance
    const currentYear = startDate.year();
    const balance = await this.getOrCreateBalance(
      leave.userId,
      currentYear,
    );

    const { paidDeduction, unpaidDeduction } = await this.validateLeaveQuota(
      leave.leaveType,
      leave.leaveSubType ?? null,
      leave.userId,
      leaveDays,
      balance,
      startDate,
      requestId,
    );

    //reset lại deduction 
    leave.paidLeaveDeduction = paidDeduction;
    leave.unpaidLeaveDeduction = unpaidDeduction;

    // Validate file INSURANCE
    if (leave.leaveType === LeaveType.INSURANCE) {
      const hasOldFiles = leave.attachments?.length > 0;
      const hasNewFiles = files?.length > 0;

      if (!hasOldFiles && !hasNewFiles) {
        throw new BadRequestException(LEAVE_ERRORS.INSURANCE_REQUIRES_ATTACHMENT);
      }
    }

    // Upload các file mới lên thẳng MinIO trước
    let uploadedFilesData: { file: Express.Multer.File; fileKey: string }[] = [];
    if (files && files.length > 0) {
      uploadedFilesData = await Promise.all(
        files.map(async (file) => {
          const fileKey = await this.storageService.uploadFile(file, 'leave');
          return { file, fileKey };
        })
      );
    }

    //transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await queryRunner.manager.save(leave);
      
      let oldFileKeysToDelete: string[] = [];

      // lưu file mới
      if (files && files.length > 0) {
        // lưu list records file cũ để tí xoá MinIO
        if (leave.attachments?.length) {
          oldFileKeysToDelete = leave.attachments.map(att => att.fileKey);
          await queryRunner.manager.delete(LeaveAttachment, { leaveRequestId: leave.id });
        }
        // lưu records file mới
        const attachments = uploadedFilesData.map((data) => {
          return queryRunner.manager.create(LeaveAttachment, {
            leaveRequestId: leave.id, 
            originalName: Buffer.from(data.file.originalname, 'latin1').toString('utf8'),
            fileKey: data.fileKey,         
            size: data.file.size,
            mimeType: data.file.mimetype,
          });
        });
        await queryRunner.manager.save(LeaveAttachment, attachments);
      }

      await queryRunner.commitTransaction();

      // Chỉ xoá trên MinIO sau khi Transaction ngon nghẻ
      if (oldFileKeysToDelete.length > 0) {
        Promise.all(oldFileKeysToDelete.map(key => this.storageService.deleteFile(key).catch(() => {})));
      }
      return {
        message: 'Cập nhật đơn nghỉ thành công',
        data: leave,
        leaveDays,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (uploadedFilesData.length > 0) {
        Promise.all(
          uploadedFilesData.map((data) => this.storageService.deleteFile(data.fileKey).catch(() => {}))
        );
      }
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // lấy chi tiết đơn xin nghỉ
  async leaveRequestDetail(user: User, id: number) {
    const leave = await this.leaveRequestRepo.findOne({
      where: { id },
      relations: ['user', 'approver', 'attachments'],
    });
    
    if (!leave) throw new NotFoundException(LEAVE_ERRORS.LEAVE_NOT_FOUND);

    // 1. Nhân viên/PC: Chỉ được xem đơn của chính mình
    if (
      EMPLOYEE_LIKE_ROLES.includes(user.role) &&
      leave.userId !== user.id
    ) {
      throw new ForbiddenException(LEAVE_ERRORS.ONLY_VIEW_OWN);
    }

    // 2. Lead & HR (trong màn hình quản lý/duyệt): Chỉ được xem đơn của nhân viên trong cùng phòng ban
    if (
      (user.role === UserRole.DEPARTMENT_LEAD || user.role === UserRole.HR) &&
      leave.user.departmentName !== user.departmentName
    ) {
      throw new ForbiddenException(LEAVE_ERRORS.VIEW_OWN_DEPARTMENT_ONLY);
    }

    const startDate = dayjs(leave.startDate);
    const endDate = dayjs(leave.endDate);
    const totalDays = this.calculateLeaveDays(
      startDate.toDate(),
      endDate.toDate(),
      leave.startHalfDayType,
      leave.endHalfDayType,
    );

    return {
      id: leave.id,
      userId: leave.userId,
      user: {
        name: leave.user.name,
      },
      leaveType: leave.leaveType,
      leaveSubType: leave.leaveSubType,
      startDate: leave.startDate,
      startHalfDayType: leave.startHalfDayType,
      endDate: leave.endDate,
      endHalfDayType: leave.endHalfDayType,
      totalDays,
      reason: leave.reason,
      status: leave.status,
      rejectionReason: leave.rejectionReason,
      cancelReason: leave.cancelReason,
      approver: leave.approver ? { name: leave.approver.name } : null,
      approvedAt: leave.approvedAt,
      updatedAt: leave.updatedAt,
      version: leave.version,
      attachments:
      leave.attachments?.map((att) => ({
        id: att.id,
        originalName: att.originalName
      })) ?? [],
    };
  }

  // lấy file đính kèm
  async getLeaveRequestAttachments(user: User, attachmentId: number, res: Response) {
    const attachment = await this.leaveAttachmentRepo.findOne({
      where: { id: attachmentId },
      relations: ['leaveRequest', 'leaveRequest.user'], 
    });

  if (!attachment) {
    throw new NotFoundException(LEAVE_ERRORS.ATTACHMENT_NOT_FOUND);
  }

  if (
    EMPLOYEE_LIKE_ROLES.includes(user.role) &&
    attachment.leaveRequest?.userId !== user.id
  ) {
    throw new ForbiddenException(LEAVE_ERRORS.VIEW_ATTACHMENT_FORBIDDEN);
  }

  // Phân quyền cho Lead và HR: Chỉ xem được file đính kèm của nhân viên cùng phòng ban
  if (
    (user.role === UserRole.DEPARTMENT_LEAD || user.role === UserRole.HR) &&
    attachment.leaveRequest?.user?.departmentName !== user.departmentName
  ) {
    throw new ForbiddenException(LEAVE_ERRORS.VIEW_OWN_DEPARTMENT_ONLY);
  }

    const fileStream = await this.storageService.getFileStream(attachment.fileKey);

    //  Set header để xem inline, không tải xuống (hỗ trợ tên file tiếng Việt)
    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(attachment.originalName)}"; filename*=UTF-8''${encodeURIComponent(attachment.originalName)}`,
    );

    fileStream.pipe(res); 
  }

  // Tính số ngày nghỉ (startDate → endDate, inclusive)
  private calculateLeaveDays(startDate: Date, endDate: Date, startHalf: HalfDayType, endHalf: HalfDayType): number {
    const start = dayjs(startDate).startOf('day');
    const end = dayjs(endDate).startOf('day');

    const diff = end.diff(start, 'day');
    let total = diff + 1;

    if (startHalf === HalfDayType.AFTERNOON) total -= LEAVE_CONSTANTS.HALF_DAY;
    if (endHalf === HalfDayType.MORNING) total -= LEAVE_CONSTANTS.HALF_DAY;

    return Math.max(LEAVE_CONSTANTS.MIN_LEAVE_DAYS, total);
  }

  // lấy hoặc tạo quỹ nghỉ
  private async getOrCreateBalance(
    userId: number,
    year: number,
  ): Promise<LeaveBalance> {
    let balance = await this.leaveBalanceRepo.findOne({
      where: { userId, year },
    });

    if (balance) {
      return balance;
    }

    const user = await this.userRepo.findOne({where:{id: userId}})
    if (!user) throw new NotFoundException(LEAVE_ERRORS.USER_NOT_FOUND)
    balance = await this.leaveAccrualService.backfillLeaveForUser(user);

    return balance;
  }

  private async getSubTypeLimit(leaveType: LeaveType, leaveSubType: string): Promise<LeaveConfig | null> {
    return this.leaveConfigRepo.findOne({
      where: {
        leaveType,
        leaveSubType,
      },
    });
  }

  private async getUsedDaysForSubType(
    userId: number,
    subType: string,
    year: number,
    month?: number,
    requestId?: number
  ): Promise<number> {
    const query = this.leaveRequestRepo
      .createQueryBuilder('lr')
      .where('lr.userId = :userId', { userId })
      .andWhere('lr.leaveSubType = :subType', { subType })
      .andWhere('lr.status = :status', { status: LeaveRequestStatus.APPROVED });

    if (requestId) {
      query.andWhere('lr.id != :excludeId', {
        excludeId: requestId,
      });
    }
    
    if (month !== undefined) {
      //tháng trong query là 1-12, month nhận vào là 0-11
      query.andWhere('MONTH(lr.startDate) = :month AND YEAR(lr.startDate) = :year', {
        month: month + 1,
        year,
      });
    } else {
      query.andWhere('YEAR(lr.startDate) = :year', { year });
    }

    const requests = await query.getMany();
    
    return requests.reduce(
      (total, req) => {
        const reqStart = dayjs(req.startDate).startOf('day');
        const reqEnd = dayjs(req.endDate).startOf('day');
        return total + this.calculateLeaveDays(reqStart.toDate(), reqEnd.toDate(), req.startHalfDayType, req.endHalfDayType)
      },
      0,
    );
  }

  private validateLeaveSubType(leaveType: LeaveType, leaveSubType?: string | null) {
    if (
      leaveType === LeaveType.PAID ||
      leaveType === LeaveType.UNPAID ||
      leaveType === LeaveType.COMPENSATORY
    ) {
      if (leaveSubType) {
        throw new BadRequestException(LEAVE_ERRORS.SUBTYPE_NOT_ALLOWED);
      }
      return;
    }
    
    // Nếu là Phép Bảo Hiểm hoặc Việc Riêng
    if (!leaveSubType) {
      throw new BadRequestException(LEAVE_ERRORS.SUBTYPE_REQUIRED);
    }
  }

  //Hàm kiểm tra trùng buổi hay không nếu trùng ngày
  private getSlots(
    date: dayjs.Dayjs,
    dStart: dayjs.Dayjs,
    dEnd: dayjs.Dayjs,
    sHalf: HalfDayType,
    eHalf: HalfDayType,
  ) {
    const { SLOT_MORNING, SLOT_AFTERNOON } = LEAVE_CONSTANTS
     const isStartDay = date.isSame(dStart, 'day');
     const isEndDay = date.isSame(dEnd, 'day');

    if (isStartDay && isEndDay) {
      if (sHalf === HalfDayType.MORNING && eHalf === HalfDayType.MORNING) return [SLOT_MORNING];
      if (sHalf === HalfDayType.AFTERNOON && eHalf === HalfDayType.AFTERNOON) return [SLOT_AFTERNOON];
      return [SLOT_MORNING, SLOT_AFTERNOON];
    }

    if (isStartDay) return sHalf === HalfDayType.MORNING ? [SLOT_MORNING, SLOT_AFTERNOON] : [SLOT_AFTERNOON];
    if (isEndDay) return eHalf === HalfDayType.MORNING ? [SLOT_MORNING] : [SLOT_MORNING, SLOT_AFTERNOON];
    return [SLOT_MORNING, SLOT_AFTERNOON];
  }

  //Hàm check xem trùng ngày và lặp qua từng ngày trùng đó 
  private async checkScheduleConflict(
    userId: number,
    startDate: dayjs.Dayjs,
    endDate: dayjs.Dayjs,
    startHalf: HalfDayType,
    endHalf: HalfDayType,
    excludeId?: number
  ): Promise<void> {
    const existingRequests = await this.leaveRequestRepo.find({
      where: {
        userId,
        status: In([LeaveRequestStatus.APPROVED, LeaveRequestStatus.PENDING]),
        ...(excludeId && { id: Not(excludeId) }),
      },
    });

    for (const req of existingRequests) {
      const reqStart = dayjs(req.startDate).startOf('day');
      const reqEnd = dayjs(req.endDate).startOf('day');

      if (
        (startDate.isBefore(reqEnd) || startDate.isSame(reqEnd)) &&
        (endDate.isAfter(reqStart) || endDate.isSame(reqStart))
      ) {
        const overlapStart = startDate.isAfter(reqStart) ? startDate : reqStart;
        const overlapEnd = endDate.isBefore(reqEnd) ? endDate : reqEnd;

        for (
          let d = overlapStart;
          d.isBefore(overlapEnd) || d.isSame(overlapEnd);
          d = d.add(1, 'day')
        ) {
          const newSlots = this.getSlots(d, startDate, endDate, startHalf, endHalf);
          const oldSlots = this.getSlots(d, reqStart, reqEnd, req.startHalfDayType, req.endHalfDayType);

          if (newSlots.some(s => oldSlots.includes(s))) {
            throw new BadRequestException({
              ...LEAVE_ERRORS.SCHEDULE_CONFLICT,
              details: `Trùng với đơn ${reqStart.format('DD/MM/YYYY')} ${req.startHalfDayType} - ${reqEnd.format('DD/MM/YYYY')} ${req.endHalfDayType}`,
            });
          }
        }
      }
    }
  }

  // Hàm kiểm tra số ngày nghỉ có đủ không
  private async validateLeaveQuota(
    leaveType: LeaveType,
    leaveSubType: string | null,
    userId: number,
    leaveDays: number,
    balance: LeaveBalance,
    startDate: dayjs.Dayjs,
    excludeId?: number,
  ): Promise<{ paidDeduction: number; unpaidDeduction: number }> {

    let paidDeduction = 0;
    let unpaidDeduction = 0;

    if (leaveType === LeaveType.PERSONAL_PAID || leaveType === LeaveType.INSURANCE) {
      if (!leaveSubType) {
        throw new BadRequestException(LEAVE_ERRORS.SUBTYPE_REQUIRED);
      }

      const config = await this.getSubTypeLimit(leaveType, leaveSubType);
      if (!config) {
        throw new BadRequestException(LEAVE_ERRORS.SUBTYPE_NOT_FOUND);
      }

      const usedDays = await this.getUsedDaysForSubType(
        userId,
        leaveSubType,
        startDate.year(),
        config.isPerMonth ? startDate.month() : undefined,
        excludeId,
      );

      const remaining = Number(config.limit) - usedDays;
      if (leaveDays > remaining) {
        throw new BadRequestException({
          ...LEAVE_ERRORS.SUBTYPE_QUOTA_EXCEEDED,
          details: `Bạn chỉ còn ${remaining} ngày cho loại nghỉ ${leaveSubType}`,
        });
      }

    } else if (leaveType === LeaveType.PAID) {
      const annualRemaining = Number(balance.annualLeaveTotal) - Number(balance.annualLeaveUsed);
      if (annualRemaining < leaveDays) {
        throw new BadRequestException({
          ...LEAVE_ERRORS.INSUFFICIENT_ANNUAL_LEAVE,
          details: `Bạn chỉ còn ${annualRemaining} ngày phép năm, không đủ cho ${leaveDays} ngày`,
        });
      }
      paidDeduction = leaveDays;

    } else if (leaveType === LeaveType.UNPAID) {
      unpaidDeduction = leaveDays;

    } else if (leaveType === LeaveType.COMPENSATORY) {
      const compBalance = Number(balance.compensatoryBalance);
      const requiredHours = leaveDays * LEAVE_CONSTANTS.HOURS_PER_DAY;
      if (requiredHours > compBalance) {
        throw new BadRequestException({
          ...LEAVE_ERRORS.INSUFFICIENT_COMPENSATORY,
          details: `Bạn chỉ còn ${compBalance} giờ nghỉ bù, không đủ cho ${requiredHours} giờ yêu cầu`,
        });
      }
    }

    return { paidDeduction, unpaidDeduction };
  }
}

