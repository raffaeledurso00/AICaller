import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Get the status as a number
    const statusCode: number =
      exception.getStatus?.() || HttpStatus.INTERNAL_SERVER_ERROR;

    const errorResponse = {
      statusCode,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message: exception.message || null,
    };

    // Use a type guard to ensure correct comparison
    const isInternalServerError =
      statusCode === +HttpStatus.INTERNAL_SERVER_ERROR;

    if (isInternalServerError) {
      this.logger.error(
        `Internal Server Error: ${request.method} ${request.url}`,
        exception.stack,
      );
    } else {
      this.logger.warn(
        `Exception: ${request.method} ${request.url} - Status: ${statusCode} - Message: ${exception.message}`,
      );
    }

    response.status(statusCode).json(errorResponse);
  }
}
