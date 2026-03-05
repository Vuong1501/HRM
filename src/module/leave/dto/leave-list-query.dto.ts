import { LeaveRequestStatus } from "src/common/enums/leave-request-status.enum";
import { IsOptional, IsEnum, IsString, IsInt, IsDateString, Min, Max } from "class-validator";
import { PaginationDto } from "src/common/pagination/pagination.dto";
import { Type } from 'class-transformer';

export class LeaveListQueryDto extends PaginationDto {

  @IsOptional()
  @IsEnum(LeaveRequestStatus)
  status?: LeaveRequestStatus;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  year?: number;

}