import { IsEmail, MinLength, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ example: 'hr@gmail.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '123456789' })
  @MinLength(6)
  password: string;

  @IsString()
  name: string;
}
