import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

enum CircuitState {
  CLOSED = 'closed',   // Normal operation, requests pass through
  OPEN = 'open',       // Circuit is open, requests fail fast
  HALF_OPEN = 'half-open', // Testing if service is recovered
}

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  resetTimeout?: number;
  halfOpenSuccessThreshold?: number;
}

interface CircuitBreakerStatus {
  state: CircuitState;
  failures: number;
  lastFailure: Date | null;
  successesInHalfOpen: number;
}

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private readonly defaultFailureThreshold: number;
  private readonly defaultResetTimeout: number;
  private readonly defaultHalfOpenSuccessThreshold: number;
  private readonly circuitBreakers = new Map<string, CircuitBreakerStatus>();

  constructor(private readonly configService: ConfigService) {
    this.defaultFailureThreshold = this.configService.get<number>('resilience.failureThreshold', 5);
    this.defaultResetTimeout = this.configService.get<number>('resilience.resetTimeout', 30000);
    this.defaultHalfOpenSuccessThreshold = this.configService.get<number>('resilience.halfOpenSuccessThreshold', 2);
  }

  /**
   * Execute a function with circuit breaker protection
   * @param serviceKey A unique key to identify the service
   * @param fn The function to execute
   * @param options Circuit breaker options
   * @returns The result of the function execution
   */
  async executeWithCircuitBreaker<T>(
    serviceKey: string,
    fn: () => Promise<T>,
    options: CircuitBreakerOptions = {},
  ): Promise<T> {
    const failureThreshold = options.failureThreshold ?? this.defaultFailureThreshold;
    const resetTimeout = options.resetTimeout ?? this.defaultResetTimeout;
    const halfOpenSuccessThreshold = options.halfOpenSuccessThreshold ?? this.defaultHalfOpenSuccessThreshold;

    // Get or initialize circuit breaker for this service
    if (!this.circuitBreakers.has(serviceKey)) {
      this.circuitBreakers.set(serviceKey, {
        state: CircuitState.CLOSED,
        failures: 0,
        lastFailure: null,
        successesInHalfOpen: 0,
      });
    }

    const circuitBreaker = this.circuitBreakers.get(serviceKey)!;

    // Check if circuit is OPEN
    if (circuitBreaker.state === CircuitState.OPEN) {
      // Check if reset timeout has elapsed
      const now = new Date();
      if (circuitBreaker.lastFailure && 
          (now.getTime() - circuitBreaker.lastFailure.getTime() > resetTimeout)) {
        // Transition to HALF-OPEN
        this.logger.log(`Circuit for ${serviceKey} transitioning from OPEN to HALF-OPEN`);
        circuitBreaker.state = CircuitState.HALF_OPEN;
        circuitBreaker.successesInHalfOpen = 0;
      } else {
        // Circuit is OPEN and timeout hasn't elapsed, fail fast
        this.logger.warn(`Circuit for ${serviceKey} is OPEN, fast-failing request`);
        throw new Error(`Service ${serviceKey} is unavailable (circuit open)`);
      }
    }

    try {
      // Execute the function
      const result = await fn();

      // Handle success based on current state
      if (circuitBreaker.state === CircuitState.HALF_OPEN) {
        circuitBreaker.successesInHalfOpen++;
        
        if (circuitBreaker.successesInHalfOpen >= halfOpenSuccessThreshold) {
          // Transition to CLOSED
          this.logger.log(`Circuit for ${serviceKey} transitioning from HALF-OPEN to CLOSED`);
          circuitBreaker.state = CircuitState.CLOSED;
          circuitBreaker.failures = 0;
        }
      } else if (circuitBreaker.state === CircuitState.CLOSED) {
        // Reset failure count on success in closed state
        circuitBreaker.failures = 0;
      }

      return result;
    } catch (error) {
      // Handle failure
      circuitBreaker.failures++;
      circuitBreaker.lastFailure = new Date();

      if (circuitBreaker.state === CircuitState.CLOSED && 
          circuitBreaker.failures >= failureThreshold) {
        // Transition to OPEN
        this.logger.warn(`Circuit for ${serviceKey} transitioning from CLOSED to OPEN after ${failureThreshold} failures`);
        circuitBreaker.state = CircuitState.OPEN;
      } else if (circuitBreaker.state === CircuitState.HALF_OPEN) {
        // Transition back to OPEN on any failure in HALF-OPEN
        this.logger.warn(`Circuit for ${serviceKey} transitioning from HALF-OPEN back to OPEN after failure`);
        circuitBreaker.state = CircuitState.OPEN;
      }

      throw error;
    }
  }

  /**
   * Get the current state of a circuit breaker
   * @param serviceKey The service key
   * @returns The current circuit breaker state or null if not found
   */
  getCircuitState(serviceKey: string): CircuitState | null {
    if (!this.circuitBreakers.has(serviceKey)) {
      return null;
    }
    return this.circuitBreakers.get(serviceKey)!.state;
  }

  /**
   * Reset a circuit breaker to CLOSED state
   * @param serviceKey The service key
   */
  resetCircuit(serviceKey: string): void {
    if (this.circuitBreakers.has(serviceKey)) {
      this.logger.log(`Manually resetting circuit for ${serviceKey} to CLOSED`);
      this.circuitBreakers.set(serviceKey, {
        state: CircuitState.CLOSED,
        failures: 0,
        lastFailure: null,
        successesInHalfOpen: 0,
      });
    }
  }

  /**
   * Get detailed status of all circuit breakers
   */
  getAllCircuitStatuses(): Record<string, { state: string; failures: number; lastFailure: Date | null }> {
    const statuses: Record<string, any> = {};
    
    this.circuitBreakers.forEach((status, key) => {
      statuses[key] = {
        state: status.state,
        failures: status.failures,
        lastFailure: status.lastFailure,
      };
    });
    
    return statuses;
  }
}