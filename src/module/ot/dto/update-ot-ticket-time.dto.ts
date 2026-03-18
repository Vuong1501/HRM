import { IsNotEmpty, IsString, IsDateString, IsOptional } from 'class-validator';

export class UpdateOtTicketTimeDto {
  @IsOptional()
  @IsDateString()
  updatedCheckInTime?: string;

  @IsOptional()
  @IsDateString()
  updatedCheckOutTime?: string;

  @IsString()
  @IsNotEmpty()
  reason: string;
}
