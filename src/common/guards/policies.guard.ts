import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  UnauthorizedException,
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
import { APP_ERRORS } from '../errors/app.errors';

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
    
    if (!userFromToken) throw new UnauthorizedException(APP_ERRORS.UNAUTHORIZED);

    const user = await this.userRepository.findOneBy({
      id: userFromToken.userId,
    });
    
    if (!user) throw new UnauthorizedException(APP_ERRORS.UNAUTHORIZED);
    req.userEntity = user;

    const ability = this.caslAbilityFactory.createForUser(user);
    // console.log("ability", ability);
    // (ability) => ability.can(Action.Read, User)

    const allowed = policyHandlers.every((handler) =>
      this.execPolicyHandler(handler, ability),
    );
    if (!allowed) {
      throw new ForbiddenException(APP_ERRORS.FORBIDDEN);
    }
    return true;
  }

  private execPolicyHandler(handler: PolicyHandler, ability: AppAbility) {
    if (typeof handler === 'function') {
      return handler(ability);
    }
    return handler.handle(ability);
  }
}
