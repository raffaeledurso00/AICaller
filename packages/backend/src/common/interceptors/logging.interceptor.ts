import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  HttpStatus,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

interface ErrorWithStatus {
  status?: number;
  stack?: string;
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request>();
    const { method, url, ip } = req;

    // Safely access userAgent
    const userAgent = req.headers['user-agent'] || '';

    const now = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const res = ctx.getResponse<Response>();

          this.logger.log(
            `${method} ${url} ${res.statusCode} - ${Date.now() - now}ms - ${ip} - ${userAgent}`,
          );
        },
        error: (err: ErrorWithStatus) => {
          // Properly type and handle the error object
          const statusCode =
            typeof err.status === 'number'
              ? err.status
              : HttpStatus.INTERNAL_SERVER_ERROR;
          const stackTrace =
            typeof err.stack === 'string'
              ? err.stack
              : 'No stack trace available';

          this.logger.error(
            `${method} ${url} ${statusCode} - ${Date.now() - now}ms - ${ip} - ${userAgent}`,
            stackTrace,
          );
        },
      }),
    );
  }
}
