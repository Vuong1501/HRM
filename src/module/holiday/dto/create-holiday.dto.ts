import { IsString, IsDateString, IsBoolean, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateHolidayDto {
    @IsString()
    name: string;

    @IsDateString()
    startDate: string;

    @IsDateString()
    endDate: string;

    @IsBoolean()
    @IsOptional()
    isRecurring?: boolean;
}