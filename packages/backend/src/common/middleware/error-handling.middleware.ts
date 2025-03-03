import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ErrorTrackingService } from '../../modules/resilience/services/error-tracking.service';

@Injectable()
export class ErrorHandlingMiddleware implements NestMiddleware {
  private readonly logger = new Logger(ErrorHandlingMiddleware.name);

  constructor(private readonly errorTrackingService: ErrorTrackingService) {}

  use(req: Request, res: Response, next: NextFunction) {
    // Add a handler for unhandled promise rejections in this request context
    const originalEnd = res.end;
    const originalWrite = res.write;
    let responseBody = '';

    // Override write to capture response body
    res.write = function(chunk: any, ...args: any[]) {
      responseBody += chunk.toString();
      return originalWrite.apply(res, [chunk, ...args]);
    };

    // Override end to check for unhandled errors before finishing response
    res.end = function(...args: any[]) {
      // Check if response is an error
      if (res.statusCode >= 500) {
        // Track server errors
        const error = new Error(`Server error ${res.statusCode}: ${responseBody}`);
        this.errorTrackingService.trackError('http', error, {
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          body: responseBody,
        }).catch(e => {
          this.logger.error(`Failed to track error: ${e.message}`);
        });
      }
      return originalEnd.apply(res, args);
    }.bind(this);

    // Catch any errors in the middleware chain
    try {
      next();
    } catch (error) {
      this.logger.error(`Uncaught error in middleware: ${error.message}`, error.stack);
      this.errorTrackingService.trackError('middleware', error, {
        method: req.method,
        url: req.url,
      }).catch(e => {
        this.logger.error(`Failed to track error: ${e.message}`);
      });
      
      // Continue to error handler
      next(error);
    }
  }
}