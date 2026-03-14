import { OtPlanStatus } from 'src/common/enums/ot/ot-status.enum';
import { IsOptional, IsEnum, IsString, IsInt, IsDateString, Min, Max } from 'class-validator';
import { PaginationDto } from 'src/common/pagination/pagination.dto';
import { Type } from 'class-transformer';

export class OtPlanListQueryDto extends PaginationDto {
  @IsOptional()
  @IsEnum(OtPlanStatus)
  status?: OtPlanStatus;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  department?: string; // Dành riêng cho admin

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
