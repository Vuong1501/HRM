import {
  IsEmail,
  IsNotEmpty,
  IsDateString,
  IsEnum,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SexEnum } from 'src/common/enums/user-sex.enum';
import { UserRole } from 'src/common/enums/user-role.enum';
import { EmploymentType } from 'src/common/enums/user-employeeType.enum';

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

  @ApiProperty({ example: '1999-01-01' })
  @IsDateString()
  dateOfBirth: string;

  @ApiProperty({ example: 'IT' })
  @IsNotEmpty()
  departmentName: string;

  // quyền hệ thống
  @ApiProperty({ enum: UserRole, example: UserRole.EMPLOYEE })
  @IsEnum(UserRole)
  role: UserRole;

  // loại nhân sự
  @ApiProperty({ enum: EmploymentType, example: EmploymentType.OFFICIAL })
  @IsEnum(EmploymentType)
  employmentType: EmploymentType;

  @ApiProperty({ example: 'Ha Noi' })
  @IsNotEmpty()
  address: string;

  @ApiProperty({ enum: SexEnum })
  @IsEnum(SexEnum)
  sex: SexEnum;

  @ApiProperty({ example: '0987654321' })
  @Matches(/^(0|\+84)[0-9]{9}$/, {
    message: 'Phone number không đúng định dạng',
  })
  phoneNumber: string;

  @ApiProperty({ example: '2025-02-01' })
  @IsDateString()
  startDate: string;
}
