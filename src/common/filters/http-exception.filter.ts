import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import dayjs from 'dayjs';

interface HttpExceptionResponse {
  message?: string | string[];
  code?: string;
  details?: unknown;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private logger = new Logger('Exception');
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    // 1. Xác định Status Code
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    // 2. Bóc tách message, code, detail (Giữ nguyên logic của bạn nhưng gọn hơn)
    let message = 'Internal server error';
    let code = 'INTERNAL_SERVER_ERROR';
    let detail: unknown = null;
    if (exception instanceof HttpException) {
      const res = exception.getResponse() as any;
      // ValidationPipe thường trả về message là mảng string
      message = Array.isArray(res.message) ? res.message.join(', ') : (res.message || res);
      code = res.code || code;
      detail = res.details || null;
    } else if (exception instanceof Error) {
      message = exception.message;
    }
    // 3. LOG "CHUẨN": Phân biệt 4xx và 5xx
    const logInfo = {
      path: request.url,
      method: request.method,
      status,
      message,
    };
    if (status >= 500) {
      // Lỗi Server: Log đỏ + Stack Trace để sửa code
      this.logger.error(
        `[${request.method}] ${request.url} - Error: ${message}`,
        exception instanceof Error ? exception.stack : '',
      );
    } else {
      // Lỗi Client (4xx): Log cảnh báo thôi, không cần stack trace
      this.logger.warn(
        `[${request.method}] ${request.url} - Status: ${status} - Message: ${message}`,
      );
    }
    // 4. Trả về JSON cho Client
    response.status(status).json({
      success: false,
      statusCode: status,
      code,
      message,
      detail,
      timestamp: dayjs().toISOString(),
      path: request.url,
    });
  }
}
