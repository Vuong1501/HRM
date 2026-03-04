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
      can(Action.Read, User);
      // Leave: đọc + duyệt đơn của nhân viên cùng phòng ban
      can(Action.Read, LeaveRequest);
      can(Action.Approve, LeaveRequest);
      can(Action.Reject, LeaveRequest);
      // đang có cách làm là bỏ qua điều kiện departmentName trong casl thì sẽ ok
    } else if (user.role === UserRole.EMPLOYEE) {
      can(Action.Read, User);
      can(Action.Update, User);
      // Leave: tạo, đọc, cập nhật đơn của mình
      can(Action.Create, LeaveRequest);
      can(Action.Read, LeaveRequest);
      can(Action.Update, LeaveRequest);
      can(Action.Cancel, LeaveRequest);
    }

    return build({
      detectSubjectType: (item) =>
        item.constructor as ExtractSubjectType<Subjects>,
    });
  }
}
