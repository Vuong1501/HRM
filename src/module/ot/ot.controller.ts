import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  Patch,
  Param,
  Get,
  Req,
} from '@nestjs/common';
import { OtService } from './ot.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { Action } from 'src/common/enums/action.enum';
import { OtPlan } from './entities/ot-plan.entity';
import { CreateOtPlanDto } from './dto/create-ot-plan.dto';
import { CheckPolicies } from 'src/common/decorators/policy.decorator';
import type { RequestWithUser } from 'src/common/interfaces/request-with-user.interface';
import { ApiTags } from '@nestjs/swagger';
import { PoliciesGuard } from 'src/common/guards/policies.guard';

@ApiTags('ot')
@Controller('ot')
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class OtController {
    constructor(private readonly otService: OtService){}

    @Post('plan')
    @CheckPolicies((ability) => ability.can(Action.Create, OtPlan))
    createOtPlan(
        @Req() req: RequestWithUser,
        @Body() dto: CreateOtPlanDto,
    ) {
        return this.otService.createOtPlan(req.userEntity, dto);
    }

    @Patch('plan/:id/approve')
    @CheckPolicies((ability) => ability.can(Action.Update, OtPlan))
    approveOtPlan(
        @Req() req: RequestWithUser,
        @Param('id') id: string,
    ) {
        return this.otService.approveOtPlan(req.userEntity, Number(id));
    }
}
