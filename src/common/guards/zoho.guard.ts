import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ZOHO_STRATEGY } from '../constants/zoho.constant';
import type { Request } from 'express';

@Injectable()
export class ZohoAuthGuard extends AuthGuard(ZOHO_STRATEGY) {
  getAuthenticateOptions(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>();

    return {
      state: req.query.token,
    };
  }
}
