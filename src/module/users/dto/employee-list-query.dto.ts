import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from 'src/common/pagination/pagination.dto';
import { Department } from 'src/common/enums/department.enum';
import { IsOptional, IsString, IsEnum } from 'class-validator';

export class EmployeeListQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Tìm kiếm theo tên hoặc email' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: Department, description: 'Lọc theo tên phòng ban' })
  @IsOptional()
  @IsEnum(Department)
  departmentName?: Department;
}
