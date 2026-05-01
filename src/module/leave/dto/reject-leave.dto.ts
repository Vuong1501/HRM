import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class RejectLeaveDto {
  @IsString()
  @IsNotEmpty({ message: 'Lý do từ chối không được để trống' })
  rejectionReason: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  version?: number;
}
