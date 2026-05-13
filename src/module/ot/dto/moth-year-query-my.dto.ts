import { Type } from 'class-transformer';
import { IsOptional, IsInt, Min, Max } from 'class-validator';

export class MonthYearQueryMyDto {
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