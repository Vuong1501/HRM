import { IsString, IsDateString, IsArray, ArrayMinSize, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOtPlanDto {
  @IsDateString()
  startTime: string;

  @IsDateString()
  endTime: string;

  @IsString()
  reason: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Type(() => Number)
  employeeIds: number[];
}