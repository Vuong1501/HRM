import {
  AbilityBuilder,
  createMongoAbility,
  MongoAbility,
  ExtractSubjectType,
  InferSubjects,
} from '@casl/ability';
import { Injectable } from '@nestjs/common';
import { User } from '../users/entities/user.entity';
import { Action } from 'src/common/enums/action.enum';
import { UserRole } from 'src/common/enums/user-role.enum';

type Subjects = InferSubjects<typeof User> | 'all';

export type AppAbility = MongoAbility<[Action, Subjects]>;

@Injectable()
export class CaslAbilityFactory {
  createForUser(user: User) {
    const { can, cannot, build } =
    new AbilityBuilder<MongoAbility<[Action, Subjects]>>(createMongoAbility);

    if (user.role === UserRole.ADMIN) {
      can(Action.Manage, 'all');
    }
    else if (user.role === UserRole.HR) {
      can(Action.Manage, User); 
      
    }

    else if (user.role === UserRole.DEPARTMENT_LEAD) {
      can(Action.Read, User, {departmentName: user.departmentName});
    }
    else if (user.role === UserRole.EMPLOYEE) {
      can(Action.Read, User, { id: user.id });
      can(Action.Update, User, { id: user.id });
    }

    return build({
      detectSubjectType: (item) =>
        item.constructor as ExtractSubjectType<Subjects>,
    });
  }
}
