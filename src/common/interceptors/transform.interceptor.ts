import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';

export interface ApiResponse<T> {
  success: true;
  data: T;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T>> {
    const now = Date.now();
    return next.handle().pipe(
      tap(() => {
        console.log(`API executed in ${Date.now() - now}ms`);
      }),
      map((data: T) => ({
        success: true,
        data,
      })),
    );
  }
}
