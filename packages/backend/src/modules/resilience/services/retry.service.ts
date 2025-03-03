import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface RetryOptions {
  maxRetries?: number;
  retryDelay?: number;
  exponentialBackOff?: boolean;
  retryCondition?: (error: any) => boolean;
}

@Injectable()
export class RetryService {
  private readonly logger = new Logger(RetryService.name);
  private readonly defaultMaxRetries: number;
  private readonly defaultRetryDelay: number;

  constructor(private readonly configService: ConfigService) {
    this.defaultMaxRetries = this.configService.get<number>('resilience.maxRetries', 3);
    this.defaultRetryDelay = this.configService.get<number>('resilience.retryDelay', 1000);
  }

  /**
   * Execute a function with automatic retries on failure
   * @param fn The function to execute
   * @param options Retry options
   * @returns The result of the function execution
   */
  async executeWithRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {},
  ): Promise<T> {
    const maxRetries = options.maxRetries ?? this.defaultMaxRetries;
    const retryDelay = options.retryDelay ?? this.defaultRetryDelay;
    const exponentialBackOff = options.exponentialBackOff ?? true;
    const retryCondition = options.retryCondition ?? (() => true);

    let lastError: any;
    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        if (attempt > 0) {
          this.logger.log(`Retry attempt ${attempt} of ${maxRetries}`);
        }
        return await fn();
      } catch (error) {
        lastError = error;
        
        // Check if we should retry based on error type
        if (!retryCondition(error)) {
          this.logger.warn(`Error not eligible for retry: ${error.message}`);
          throw error;
        }
        
        attempt++;
        
        if (attempt <= maxRetries) {
          // Calculate delay with exponential backoff if enabled
          const delay = exponentialBackOff 
            ? retryDelay * Math.pow(2, attempt - 1)
            : retryDelay;
            
          this.logger.warn(
            `Operation failed, retrying in ${delay}ms (${attempt}/${maxRetries}): ${error.message}`,
          );
          
          await this.sleep(delay);
        } else {
          this.logger.error(
            `Operation failed after ${maxRetries} retries: ${error.message}`,
            error.stack,
          );
          throw error;
        }
      }
    }

    throw lastError;
  }

  /**
   * Helper method to sleep for a specified number of milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}