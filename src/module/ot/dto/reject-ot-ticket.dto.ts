import { IsNotEmpty, IsString } from 'class-validator';

export class RejectOtTicketDto {
  @IsString()
  @IsNotEmpty({ message: 'Lý do từ chối không được để trống' })
  reason: string;
}
