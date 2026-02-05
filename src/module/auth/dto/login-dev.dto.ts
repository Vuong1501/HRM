import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDevDto {
  @ApiProperty({ example: 'test@gmail.com' })
  @IsEmail()
  email: string;
}
