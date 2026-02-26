import {IsOptional, IsString, IsEnum} from 'class-validator';
import { Type } from 'class-transformer';

export class QueryLeaveDto {

    @IsOptional()
    @Type(() => Number)
    page: number = 1;

    @IsOptional()
    @Type(() => Number)
    limit: number = 10;

    @IsOptional()
    @IsString()
    status?: string;

    @IsOptional()
    @Type(() => Date)
    startDate?: Date;

    @IsOptional()
    @Type(() => Number)
    year?: number;

    
}