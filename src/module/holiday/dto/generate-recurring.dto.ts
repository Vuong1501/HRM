import { IsInt } from 'class-validator';

export class GenerateRecurringDto {
    @IsInt()
    targetYear: number;
}