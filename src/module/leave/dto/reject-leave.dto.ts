import { IsNotEmpty, IsString } from 'class-validator';

export class RejectLeaveDto {
  @IsString()
  @IsNotEmpty({ message: 'Lý do từ chối không được để trống' })
  rejectionReason: string;
}
