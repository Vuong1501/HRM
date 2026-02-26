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
import { Action } from 'src/common/enums/action.enum';
import { UserRole } from 'src/common/enums/user-role.enum';

type Subjects = InferSubjects<typeof User | typeof LeaveRequest> | 'all';

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
    } else if (user.role === UserRole.DEPARTMENT_LEAD) {
      can(Action.Read, User, { departmentName: user.departmentName });
      // Leave: đọc + duyệt đơn của nhân viên cùng phòng ban
      can(Action.Read, LeaveRequest);
      can(Action.Approve, LeaveRequest);
    } else if (user.role === UserRole.EMPLOYEE) {
      can(Action.Read, User, { id: user.id });
      can(Action.Update, User, { id: user.id });
      // Leave: tạo, đọc, cập nhật đơn của mình
      can(Action.Create, LeaveRequest);
      can(Action.Read, LeaveRequest, { userId: user.id });
      can(Action.Update, LeaveRequest, { userId: user.id });
    }

    return build({
      detectSubjectType: (item) =>
        item.constructor as ExtractSubjectType<Subjects>,
    });
  }
}
