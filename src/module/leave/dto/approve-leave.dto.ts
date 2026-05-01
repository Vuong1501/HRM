import { IsInt, IsOptional, Min } from 'class-validator';

export class ApproveLeaveDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  version?: number;
}