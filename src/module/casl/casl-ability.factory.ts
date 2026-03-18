import {
  AbilityBuilder,
  createMongoAbility,
  MongoAbility,
  ExtractSubjectType,
  InferSubjects,
} from '@casl/ability';
import { Injectable } from '@nestjs/common';
import { User } from '../users/entities/user.entity';
import { LeaveRequest } from '../leave/entities/leave-request.entity';
import { OtPlan } from '../ot/entities/ot-plan.entity';
import { OtPlanEmployee } from '../ot/entities/ot-plan-employee.entity';
import { Action } from 'src/common/enums/action.enum';
import { UserRole } from 'src/common/enums/user-role.enum';
import { EMPLOYEE_LIKE_ROLES } from 'src/common/constants/role-groups.constant';

type Subjects = InferSubjects<typeof User | typeof LeaveRequest | typeof OtPlan | typeof OtPlanEmployee> | 'all';

export type AppAbility = MongoAbility<[Action, Subjects]>;

@Injectable()
export class CaslAbilityFactory {
  createForUser(user: User) {
    const { can, cannot, build } =
      new AbilityBuilder<MongoAbility<[Action, Subjects]>>(createMongoAbility);

    if (user.role === UserRole.ADMIN) {
      can(Action.Manage, 'all');
    } else if (user.role === UserRole.HR) {
      can(Action.Manage, User);

      can(Action.Read, LeaveRequest);
      can(Action.Create, LeaveRequest);

      // can(Action.Read, OtPlan);
      // can(Action.Cancel, OtPlan)

    } else if (user.role === UserRole.DEPARTMENT_LEAD) {
      can(Action.Read, User);

      can(Action.Create, LeaveRequest);
      can(Action.Update, LeaveRequest);
      can(Action.Cancel, LeaveRequest);
      can(Action.Read, LeaveRequest);
      can(Action.Approve, LeaveRequest);
      can(Action.Reject, LeaveRequest);

      can(Action.Read, OtPlan);
      can(Action.Create, OtPlan);
      can(Action.Update, OtPlan);
      can(Action.Approve, OtPlan);
      can(Action.Reject, OtPlan);
      can(Action.Cancel, OtPlan);

      can(Action.Reject, OtPlanEmployee);
      can(Action.Approve, OtPlanEmployee);
      can(Action.Read, OtPlanEmployee);
      can(Action.Update, OtPlanEmployee);
      can(Action.CheckIn, OtPlanEmployee);
      can(Action.CheckOut, OtPlanEmployee);
      can(Action.Submit, OtPlanEmployee);

    } else if (EMPLOYEE_LIKE_ROLES.includes(user.role)) {
      can(Action.Read, User);
      can(Action.Update, User);// không được đổi tên của mình, chỉ có đọc

      can(Action.Create, LeaveRequest);
      can(Action.Read, LeaveRequest);
      can(Action.Update, LeaveRequest);
      can(Action.Cancel, LeaveRequest);
      
      can(Action.Read, OtPlanEmployee);
      can(Action.CheckIn, OtPlanEmployee);
      can(Action.CheckOut, OtPlanEmployee);
      can(Action.Update, OtPlanEmployee);
      can(Action.Submit, OtPlanEmployee);

      if(user.role === UserRole.PROJECT_COORDINATOR){
        can(Action.Read, OtPlan);
        can(Action.Create, OtPlan);
        can(Action.Update, OtPlan);
        can(Action.Cancel, OtPlan);
      }
    }

    return build({
      detectSubjectType: (item) =>
        item.constructor as ExtractSubjectType<Subjects>,
    });
  }
}
