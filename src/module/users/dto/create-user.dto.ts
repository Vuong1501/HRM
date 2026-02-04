import { IsEmail, MinLength, IsString } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @MinLength(6)
  password: string;

  @IsString()
  name: string;
}
