import {
  Controller,
  Post,
  Patch,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OtService } from './ot.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { Action } from 'src/common/enums/action.enum';
import { OtPlan } from './entities/ot-plan.entity';
import { CreateOtPlanDto } from './dto/create-ot-plan.dto';
import { CheckPolicies } from 'src/common/decorators/policy.decorator';
import type { RequestWithUser } from 'src/common/interfaces/request-with-user.interface';
import { PoliciesGuard } from 'src/common/guards/policies.guard';
import { SubmitOtTicketDto } from './dto/submit-ot-ticket.dto';
import { OtPlanEmployee } from './entities/ot-plan-employee.entity';
import { RejectOtTicketDto } from './dto/reject-ot-ticket.dto';

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
    @CheckPolicies((ability) => ability.can(Action.Approve, OtPlan))
    approveOtPlan(
        @Req() req: RequestWithUser,
        @Param('id') id: string,
    ) {
        return this.otService.approveOtPlan(req.userEntity, Number(id));
    }

    @Patch('plan/:id/reject')
    @CheckPolicies((ability) => ability.can(Action.Reject, OtPlan))
    rejectOtPlan(
        @Req() req: RequestWithUser,
        @Param('id') id: string,
        @Body('rejectedReason') rejectedReason: string,
    ) {
        return this.otService.rejectOtPlan(req.userEntity, Number(id), rejectedReason);
    }

    @Patch('ticket/:id/check-in')
    @CheckPolicies((ability) => ability.can(Action.CheckIn, OtPlanEmployee))
    checkIn(
        @Req() req: RequestWithUser,
        @Param('id') ticketId: string,
    ) {
        return this.otService.checkIn(req.userEntity, Number(ticketId));
    }

    @Patch('ticket/:id/check-out')
    @CheckPolicies((ability) => ability.can(Action.CheckOut, OtPlanEmployee))
    checkOut(
        @Req() req: RequestWithUser,
        @Param('id') ticketId: string,
    ) {
        return this.otService.checkOut(req.userEntity, Number(ticketId));
    }

    @Patch('ticket/:id/submit')
    @CheckPolicies((ability) => ability.can(Action.Submit, OtPlanEmployee))
    submitOtTicket(
        @Req() req: RequestWithUser,
        @Param('id') ticketId: string,
        @Body() dto: SubmitOtTicketDto,
    ) {
        return this.otService.submitOtTicket(req.userEntity, Number(ticketId), dto);
    }

    @Patch('ticket/:id/approve')
    @CheckPolicies((ability) => ability.can(Action.Approve, OtPlanEmployee))
    approveOtTicket(
        @Req() req: RequestWithUser,
        @Param('id') id: string,
    ) {
        return this.otService.approveOtTicket(req.userEntity, Number(id));
    }

    @Patch('ticket/:id/reject')
    @CheckPolicies((ability) => ability.can(Action.Reject, OtPlanEmployee))
    rejectOtTicket(
        @Req() req: RequestWithUser,
        @Param('id') id: string,
        @Body() dto: RejectOtTicketDto,
    ) {
        return this.otService.rejectOtTicket(req.userEntity, Number(id), dto);
    }
}
