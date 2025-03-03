import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ErrorLog, ErrorLogDocument } from '../schemas/error-log.schema';

@Injectable()
export class ErrorTrackingService {
  private readonly logger = new Logger(ErrorTrackingService.name);
  private readonly errorLogEnabled: boolean;
  private readonly sentryEnabled: boolean;
  private readonly sentryDsn: string;

  constructor(
    private readonly configService: ConfigService,
    @InjectModel(ErrorLog.name) private readonly errorLogModel: Model<ErrorLogDocument>,
  ) {
    this.errorLogEnabled = this.configService.get<boolean>('resilience.errorLogEnabled', true);
    this.sentryEnabled = this.configService.get<boolean>('resilience.sentryEnabled', false);
    this.sentryDsn = this.configService.get<string>('resilience.sentryDsn', '');

    if (this.sentryEnabled) {
      // Initialize Sentry (in a real implementation)
      this.initializeSentry();
    }
  }

  /**
   * Track an error in the system
   * @param service The service or module where the error occurred
   * @param error The error object
   * @param metadata Additional context or metadata about the error
   */
  async trackError(
    service: string,
    error: Error,
    metadata: Record<string, any> = {},
  ): Promise<void> {
    this.logger.error(`Error in ${service}: ${error.message}`, error.stack);
    
    // Log to database if enabled
    if (this.errorLogEnabled) {
      try {
        await this.errorLogModel.create({
          service,
          errorMessage: error.message,
          errorStack: error.stack,
          timestamp: new Date(),
          metadata,
        });
      } catch (dbError) {
        this.logger.error(`Failed to log error to database: ${dbError.message}`);
      }
    }
    
    // Send to Sentry if enabled
    if (this.sentryEnabled) {
      this.captureInSentry(service, error, metadata);
    }
  }

  /**
   * Get recent errors for a specific service
   * @param service The service name
   * @param limit Maximum number of errors to return
   * @returns Array of recent errors
   */
  async getRecentErrors(service: string, limit: number = 50): Promise<ErrorLogDocument[]> {
    return this.errorLogModel.find({ service })
      .sort({ timestamp: -1 })
      .limit(limit)
      .exec();
  }

  /**
   * Get error counts by service
   * @param days Number of days to look back
   * @returns Error counts for each service
   */
  async getErrorCounts(days: number = 7): Promise<Record<string, number>> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const results = await this.errorLogModel.aggregate([
      { $match: { timestamp: { $gte: startDate } } },
      { $group: { _id: '$service', count: { $sum: 1 } } },
    ]).exec();
    
    // Convert to a simple object
    const counts: Record<string, number> = {};
    results.forEach(result => {
      counts[result._id] = result.count;
    });
    
    return counts;
  }

  /**
   * Initialize Sentry SDK (stub implementation)
   */
  private initializeSentry(): void {
    // In a real implementation, this would initialize the Sentry SDK
    this.logger.log('Sentry integration is enabled but not fully implemented');
    
    // Example Sentry initialization (commented out)
    /*
    import * as Sentry from '@sentry/node';
    
    Sentry.init({
      dsn: this.sentryDsn,
      environment: this.configService.get<string>('app.env', 'development'),
    });
    */
  }

  /**
   * Capture an error in Sentry (stub implementation)
   */
  private captureInSentry(service: string, error: Error, metadata: Record<string, any>): void {
    // In a real implementation, this would send the error to Sentry
    this.logger.log(`Would send error from ${service} to Sentry: ${error.message}`);
    
    // Example Sentry capture (commented out)
    /*
    import * as Sentry from '@sentry/node';
    
    Sentry.withScope(scope => {
      scope.setTag('service', service);
      
      // Add metadata as extra context
      Object.entries(metadata).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
      
      Sentry.captureException(error);
    });
    */
  }
}