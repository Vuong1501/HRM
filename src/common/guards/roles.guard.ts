import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole } from '../enums/user-role.enum';
import type { RequestWithUser } from '../interfaces/request-with-user.interface';
import { APP_ERRORS } from '../errors/app.errors';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!roles) return true;

    const req = context.switchToHttp().getRequest<RequestWithUser>();
    const user = req.user;

    if (!user) throw new ForbiddenException(APP_ERRORS.FORBIDDEN);

    if (!roles.includes(user.role)) {
      throw new ForbiddenException(APP_ERRORS.FORBIDDEN);
    }
    return true;
  }
}
