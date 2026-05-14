import { IsOptional, IsInt, IsEnum, IsString } from 'class-validator';
import { Department } from 'src/common/enums/department.enum';
import { PaginationDto } from 'src/common/pagination/pagination.dto';
import { Type } from 'class-transformer';

export class SummaryListTicketQueryDto extends PaginationDto {

    @IsOptional()
    @IsEnum(Department)
    department?: Department;

    @IsOptional()
    @IsString()
    search?: string;
}