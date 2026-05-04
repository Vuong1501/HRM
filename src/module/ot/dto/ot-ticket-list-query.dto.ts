import { IsOptional, IsEnum, IsString, IsInt, IsDateString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from 'src/common/pagination/pagination.dto';
import { OtPlanEmployeeStatus } from 'src/common/enums/ot/ot-employee-status.enum';

export class OtTicketListQueryDto extends PaginationDto {
  @IsOptional()
  @IsEnum(OtPlanEmployeeStatus)
  status?: OtPlanEmployeeStatus;

  @IsOptional()
  @IsString()
  search?: string;

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
