import { IsDateString, IsEnum, IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { HalfDayType } from 'src/common/enums/halfDayType.enum';
import { LeaveType } from 'src/common/enums/leave-type.enum';
import { InsuranceSubType, PersonalPaidSubType } from 'src/common/enums/leave-subType.enum';

export class CreateLeaveRequestDto {
  @IsEnum(LeaveType)
  leaveType: LeaveType;

  @IsOptional()
  @IsString()
  leaveSubType?: InsuranceSubType | PersonalPaidSubType;

  @IsDateString()
  startDate: string;

  @IsDateString() 
  endDate: string;

  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsEnum(HalfDayType)
  startHalfDayType: HalfDayType;

  @IsEnum(HalfDayType)
  endHalfDayType: HalfDayType;
}
