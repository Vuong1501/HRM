import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LeaveConfig } from './entities/leave-config.entity';
import { LeaveType } from 'src/common/enums/leave-type.enum';
import { InsuranceSubType, PersonalPaidSubType } from 'src/common/enums/leave-subType.enum';

@Injectable()
export class LeaveSeedService implements OnModuleInit {
  constructor(
    @InjectRepository(LeaveConfig)
    private leaveConfigRepo: Repository<LeaveConfig>,
  ) {}

  async onModuleInit() {
    await this.seedLeaveConfigs();
  }

  private async seedLeaveConfigs() {
    const count = await this.leaveConfigRepo.count();
    if (count > 0) return;

    const configs = [
      {
        leaveType: LeaveType.PERSONAL_PAID,
        leaveSubType: PersonalPaidSubType.WEDDING,
        limit: 3,
        isPerMonth: false,
        description: 'Bản thân kết hôn',
      },
      {
        leaveType: LeaveType.PERSONAL_PAID,
        leaveSubType: PersonalPaidSubType.CHILD_WEDDING,
        limit: 1,
        isPerMonth: false,
        description: 'Con kết hôn',
      },
      {
        leaveType: LeaveType.PERSONAL_PAID,
        leaveSubType: PersonalPaidSubType.PARENT_DEATH,
        limit: 3,
        isPerMonth: false,
        description: 'Tứ thân phụ mẫu mất',
      },
      {
        leaveType: LeaveType.PERSONAL_PAID,
        leaveSubType: PersonalPaidSubType.SPOUSE_DEATH,
        limit: 3,
        isPerMonth: false,
        description: 'Vợ/Chồng mất',
      },
      {
        leaveType: LeaveType.PERSONAL_PAID,
        leaveSubType: PersonalPaidSubType.CHILD_DEATH,
        limit: 3,
        isPerMonth: false,
        description: 'Con cái mất',
      },
      {
        leaveType: LeaveType.INSURANCE,
        leaveSubType: InsuranceSubType.MATERNITY_CHECKUP,
        limit: 5,
        isPerMonth: true,
        description: 'Khám thai (5 ngày/tháng)',
      },
    ];

    await this.leaveConfigRepo.save(configs);
    console.log('--- Đã khởi tạo cấu hình hạn mức nghỉ phép (LeaveConfig) ---');
  }
}
