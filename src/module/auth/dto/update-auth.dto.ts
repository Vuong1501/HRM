import { PartialType } from '@nestjs/mapped-types';
import { LoginDevDto } from './login-dev.dto';

export class UpdateAuthDto extends PartialType(LoginDevDto) {}
