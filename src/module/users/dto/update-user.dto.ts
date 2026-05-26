import { IsOptional, IsEnum, IsDateString, IsString, Matches } from 'class-validator';
import { UserRole } from 'src/common/enums/user-role.enum';
import { EmploymentType } from 'src/common/enums/user-employeeType.enum';
import { Department } from 'src/common/enums/department.enum';
import { SexEnum } from 'src/common/enums/user-sex.enum';

export class UpdateUserDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsEnum(Department)
    departmentName?: Department;

    @IsOptional()
    @IsEnum(EmploymentType)
    employmentType?: EmploymentType;

    @IsOptional()
    @IsDateString()
    officialDate?: string;

    @IsOptional()
    @IsDateString()
    startDate?: string;

    @IsOptional()
    @IsEnum(UserRole)
    role?: UserRole;

    @IsOptional()
    @Matches(/^(0|\+84)[0-9]{9}$/, {
        message: 'Số điện thoại không đúng định dạng (VD: 0987654321 hoặc +84987654321)'
    })
    phoneNumber?: string;

    @IsOptional()
    @IsString()
    address?: string;

    @IsOptional()
    @IsEnum(SexEnum)
    sex?: SexEnum;

    @IsOptional()
    @IsDateString()
    dateOfBirth?: string;
}
