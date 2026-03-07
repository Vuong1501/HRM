import { IsOptional, IsEnum, IsDateString } from 'class-validator';
import { PaginationDto } from 'src/common/pagination/pagination.dto';
import { OtPlanStatus } from 'src/common/enums/ot/ot-status.enum';

export class OtPlanQueryDto extends PaginationDto {
  @IsOptional()
  @IsEnum(OtPlanStatus)
  status?: OtPlanStatus;

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;
}