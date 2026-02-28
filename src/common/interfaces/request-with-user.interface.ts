import { Request } from 'express';
import { ActiveUser } from './active-user.interface';
import { User } from 'src/module/users/entities/user.entity';

export interface RequestWithUser extends Omit<Request, 'user'> {
  user: ActiveUser;
  userEntity: User;
}
