import { IsString } from 'class-validator';

export class RejectOtPlanDto {
  @IsString()
  rejectedReason: string;
}