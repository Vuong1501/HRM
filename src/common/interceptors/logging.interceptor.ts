import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { Request } from 'express';

export interface ApiResponse<T> {
  success: true;
  data: T;
}

@Injectable()
export class LoggingInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  private readonly logger = new Logger('HTTP');
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T>> {
    const now = Date.now();
    const req = context.switchToHttp().getRequest<Request>();
    const { method, originalUrl } = req;
    return next.handle().pipe(
      tap(() => {
        const ms = Date.now() - now;
        this.logger.log(`${method} ${originalUrl} ${ms}ms`);
      }),
      map((data: T) => ({
        success: true,
        data,
      })),
    );
  }
}
