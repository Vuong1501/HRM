import { PartialType } from '@nestjs/mapped-types';
import { CreateOtPlanDto } from './create-ot-plan.dto';
import { IsInt } from 'class-validator';

export class UpdateOtPlanDto extends PartialType(CreateOtPlanDto) {
    @IsInt()
    version: number;
}