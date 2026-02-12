import { ApiProperty } from '@nestjs/swagger';
import { InviteDto } from './invite.dto';

class InviteFailure {
  @ApiProperty({ type: InviteDto })
  user: InviteDto;

  @ApiProperty({ example: 'Email đã tồn tại trong hệ thống' })
  reason: string;
}

export class InviteResultDto {
  @ApiProperty({
    description: 'Danh sách user mời thành công',
    type: [InviteDto],
  })
  success: InviteDto[];

  @ApiProperty({
    description: 'Danh sách user mời thất bại',
    type: [InviteFailure],
  })
  failed: InviteFailure[];
}

// dùng để trả kết quả sau khi gửi mail
