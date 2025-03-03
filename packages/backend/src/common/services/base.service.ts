import { Logger } from '@nestjs/common';
import { RetryService } from '../../modules/resilience/services/retry.service';
import { CircuitBreakerService } from '../../modules/resilience/services/circuit-breaker.service';
import { FallbackService } from '../../modules/resilience/services/fallback.service';
import { ErrorTrackingService } from '../../modules/resilience/services/error-tracking.service';

export abstract class BaseService {
  protected readonly logger: Logger;
  protected readonly serviceKey: string;

  constructor(
    loggerName: string,
    serviceKey: string,
    protected readonly retryService?: RetryService,
    protected readonly circuitBreakerService?: CircuitBreakerService,
    protected readonly fallbackService?: FallbackService,
    protected readonly errorTrackingService?: ErrorTrackingService,
  ) {
    this.logger = new Logger(loggerName);
    this.serviceKey = serviceKey;
  }

  /**
   * Execute a method with resilience patterns
   * @param fn The function to execute
   * @param options Options for resilience
   */
  protected async executeWithResilience<T>(
    fn: () => Promise<T>,
    options: {
      useCircuitBreaker?: boolean;
      useRetry?: boolean;
      fallbackValue?: T;
      retryOptions?: {
        maxRetries?: number;
        retryDelay?: number;
        retryCondition?: (error: any) => boolean;
      };
      circuitBreakerKey?: string;
      trackError?: boolean;
      errorMetadata?: Record<string, any>;
    } = {},
  ): Promise<T> {
    const {
      useCircuitBreaker = true,
      useRetry = true,
      fallbackValue,
      retryOptions = {},
      circuitBreakerKey = this.serviceKey,
      trackError = true,
      errorMetadata = {},
    } = options;

    // Function to track errors if enabled
    const trackErrorFn = async (error: Error): Promise<void> => {
      if (trackError && this.errorTrackingService) {
        await this.errorTrackingService.trackError(
          this.serviceKey,
          error,
          errorMetadata,
        );
      }
    };

    // Wrap the function to track errors
    const wrappedFn = async (): Promise<T> => {
      try {
        return await fn();
      } catch (error) {
        // Track error
        await trackErrorFn(error);
        throw error;
      }
    };

    try {
      // Apply circuit breaker if enabled
      if (useCircuitBreaker && this.circuitBreakerService) {
        if (useRetry && this.retryService) {
          // Circuit breaker with retry
          return await this.circuitBreakerService.executeWithCircuitBreaker(
            circuitBreakerKey,
            () => this.retryService!.executeWithRetry(wrappedFn, retryOptions),
          );
        } else {
          // Circuit breaker without retry
          return await this.circuitBreakerService.executeWithCircuitBreaker(
            circuitBreakerKey,
            wrappedFn,
          );
        }
      } else if (useRetry && this.retryService) {
        // Retry without circuit breaker
        return await this.retryService.executeWithRetry(wrappedFn, retryOptions);
      } else {
        // No resilience, just execute
        return await wrappedFn();
      }
    } catch (error) {
      // If fallback value is provided, use it
      if (fallbackValue !== undefined && this.fallbackService) {
        return this.fallbackService.executeWithFallbackValue(
          () => { throw error; },
          { fallbackValue },
        );
      }
      throw error;
    }
  }
}