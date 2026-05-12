import { Type } from 'class-transformer';
import { IsOptional, IsInt, Min, Max, IsEnum, IsString } from 'class-validator';
import { Department } from 'src/common/enums/department.enum';
import { PaginationDto } from 'src/common/pagination/pagination.dto';

export class MonthYearQueryHRDto extends PaginationDto {

    @IsOptional()
    @IsEnum(Department)
    department?: Department;

    @IsOptional()
    @IsString()
    search?: string;
    
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