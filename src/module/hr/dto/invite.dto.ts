import { IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class InviteDto {
  @ApiProperty({
    example: 'test@gmail.com',
    description: 'Email người cần mời',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'Test',
    description: 'Tên người được mời vào hệ thống',
  })
  @IsNotEmpty()
  name: string;
}
