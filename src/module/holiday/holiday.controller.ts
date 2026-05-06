import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Query,
    Req,
    UseGuards,
} from '@nestjs/common';
import dayjs from 'dayjs';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { PoliciesGuard } from 'src/common/guards/policies.guard';
import { CheckPolicies } from 'src/common/decorators/policy.decorator';
import { Action } from 'src/common/enums/action.enum';
import { HolidayService } from './holiday.service';
import { Holiday } from './entities/holiday.entity';
import type { RequestWithUser } from 'src/common/interfaces/request-with-user.interface';
import { CreateHolidayDto } from './dto/create-holiday.dto';
import { UpdateHolidayDto } from './dto/update-holiday.dto';
import { GenerateRecurringDto } from './dto/generate-recurring.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('holidays')
@ApiBearerAuth() 
@Controller('holidays')
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class HolidayController {
    constructor(private readonly holidayService: HolidayService) { }

    @Post('create')
    @CheckPolicies((ability) => ability.can(Action.Create, Holiday))  
    create(@Req() req: RequestWithUser, @Body() dto: CreateHolidayDto) {
        return this.holidayService.createHoliday(req.userEntity.id, dto);
    }

}
