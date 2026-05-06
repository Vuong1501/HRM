import { IsOptional, IsEnum, IsDateString, IsString } from 'class-validator';
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
    @IsString()
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
