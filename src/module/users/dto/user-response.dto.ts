import { Department } from 'src/common/enums/department.enum';

export class UserResponseDto {
  id: number;
  email: string;
  name: string;
  departmentName: Department | null;
  createdAt: Date;
  role: string;
}
