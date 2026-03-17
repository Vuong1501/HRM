import { IsNotEmpty, IsString, IsDateString } from 'class-validator';

export class UpdateOtTicketTimeDto {
  @IsDateString()
  updatedCheckInTime: string;

  @IsDateString()
  updatedCheckOutTime: string;

  @IsString()
  @IsNotEmpty()
  reason: string;
}
