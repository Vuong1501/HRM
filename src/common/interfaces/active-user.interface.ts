import { UserRole } from '../enums/user-role.enum';

export interface ActiveUser {
  userId: number;
  email: string;
  role: UserRole;
}
