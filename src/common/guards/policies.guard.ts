import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  AppAbility,
  CaslAbilityFactory,
} from 'src/module/casl/casl-ability.factory';
import { CHECK_POLICIES_KEY } from '../decorators/policy.decorator';
import { PolicyHandler } from '../interfaces/policy-handler.interface';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/module/users/entities/user.entity';
import { Repository } from 'typeorm';
import { ActiveUser } from '../interfaces/active-user.interface';
import type { RequestWithUser } from '../interfaces/request-with-user.interface';

@Injectable()
export class PoliciesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private caslAbilityFactory: CaslAbilityFactory,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // nó sẽ kiểm tra bên controller có decorator @CheckPolicies không
    const policyHandlers =
      this.reflector.get<PolicyHandler[]>(
        CHECK_POLICIES_KEY,
        context.getHandler(),
      ) || [];

    const req = context.switchToHttp().getRequest<RequestWithUser>();
    const userFromToken = req.user;
    
    if (!userFromToken) return false;

    const user = await this.userRepository.findOneBy({
      id: userFromToken.userId,
    });
    console.log("user", user);
    
    if (!user) return false;
    req.userEntity = user;

    const ability = this.caslAbilityFactory.createForUser(user);
    console.log("ability", ability);
    // (ability) => ability.can(Action.Read, User)

    return policyHandlers.every((handler) =>
      this.execPolicyHandler(handler, ability),
    );
  }

  private execPolicyHandler(handler: PolicyHandler, ability: AppAbility) {
    if (typeof handler === 'function') {
      return handler(ability);
    }
    return handler.handle(ability);
  }
}
