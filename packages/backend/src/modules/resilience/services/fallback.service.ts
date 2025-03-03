import { Injectable, Logger } from '@nestjs/common';

export interface FallbackOptions<T> {
  fallbackValue?: T;
  shouldFallback?: (error: any) => boolean;
}

@Injectable()
export class FallbackService {
  private readonly logger = new Logger(FallbackService.name);

  /**
   * Execute a function with a fallback if it fails
   * @param fn The primary function to execute
   * @param fallbackFn The fallback function to execute if primary fails
   * @param options Fallback options
   * @returns The result of primary or fallback function
   */
  async executeWithFallback<T>(
    fn: () => Promise<T>,
    fallbackFn: () => Promise<T>,
    options: FallbackOptions<T> = {},
  ): Promise<T> {
    const shouldFallback = options.shouldFallback ?? (() => true);
    
    try {
      return await fn();
    } catch (error) {
      if (shouldFallback(error)) {
        this.logger.warn(`Primary operation failed, using fallback: ${error.message}`);
        return await fallbackFn();
      }
      
      throw error;
    }
  }

  /**
   * Execute a function with a static fallback value if it fails
   * @param fn The function to execute
   * @param options Fallback options with required fallbackValue
   * @returns The result of the function or fallback value
   */
  async executeWithFallbackValue<T>(
    fn: () => Promise<T>,
    options: FallbackOptions<T> & { fallbackValue: T },
  ): Promise<T> {
    const { fallbackValue, shouldFallback = () => true } = options;
    
    try {
      return await fn();
    } catch (error) {
      if (shouldFallback(error)) {
        this.logger.warn(`Operation failed, using fallback value: ${error.message}`);
        return fallbackValue;
      }
      
      throw error;
    }
  }

  /**
   * Execute with multiple backup functions in sequence
   * @param functions Array of functions to try in sequence
   * @returns Result of the first successful function
   */
  async executeWithBackupSequence<T>(functions: Array<() => Promise<T>>): Promise<T> {
    if (functions.length === 0) {
      throw new Error('No functions provided for backup sequence');
    }
    
    let lastError: any;
    
    for (let i = 0; i < functions.length; i++) {
      try {
        if (i > 0) {
          this.logger.log(`Trying backup function ${i} of ${functions.length - 1}`);
        }
        return await functions[i]();
      } catch (error) {
        lastError = error;
        this.logger.warn(`Function ${i} failed: ${error.message}`);
      }
    }
    
    this.logger.error(`All functions in backup sequence failed`);
    throw lastError;
  }
}