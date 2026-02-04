import { IsEmail, IsNotEmpty } from 'class-validator';

export class InviteDto {
  @IsEmail()
  email: string;

  @IsNotEmpty()
  name: string;
}
