import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
interface HttpExceptionResponse {
  message?: string | string[];
  code?: string;
  details?: unknown;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost) {
    if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack);
    } else {
      this.logger.error(String(exception));
    }

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message = 'Internal server error';
    let code = 'INTERNAL_SERVER_ERROR';     
    let detail: unknown = null;           

    if (exception instanceof HttpException) {
      const res = exception.getResponse() as HttpExceptionResponse | string;
      if (typeof res === 'string') {
        message = res;
      } else {
        message = Array.isArray(res.message)
          ? res.message.join(', ')
          : (res.message ?? message);
        code = res.code ?? code;          
        detail = res.details ?? null;    
      }
    }
    response.status(status).json({
      success: false,
      statusCode: status,
      code,
      message,
      detail,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
