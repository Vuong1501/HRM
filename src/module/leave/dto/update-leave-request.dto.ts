import { PartialType } from '@nestjs/mapped-types';
import { CreateLeaveRequestDto } from './create-leave-request.dto';
import { IsDateString, IsNotEmpty } from 'class-validator';

export class UpdateLeaveRequestDto extends PartialType(CreateLeaveRequestDto) {
  @IsDateString()
  @IsNotEmpty()
  clientUpdatedAt: string;
}