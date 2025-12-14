// backend/src/utils/circuitBreaker.ts

/**
 * Circuit breaker pattern - prevents cascading failures
 * Opens after N failures, blocks requests, closes after timeout
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private threshold = 5,      // Open after 5 failures
    private timeout = 60000     // Try again after 60 seconds
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Circuit is open - reject immediately
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailTime > this.timeout) {
        console.log('[Circuit Breaker] Transitioning to HALF_OPEN, trying request...');
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN - ICICI API temporarily unavailable');
      }
    }

    try {
      const result = await fn();
      this.reset();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  private recordFailure() {
    this.failures++;
    this.lastFailTime = Date.now();
    
    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
      console.error(`[Circuit Breaker] OPENED after ${this.failures} consecutive failures`);
    }
  }

  private reset() {
    if (this.state === 'HALF_OPEN') {
      console.log('[Circuit Breaker] Request succeeded, closing circuit');
    }
    this.failures = 0;
    this.state = 'CLOSED';
  }
}

// Export a singleton instance
export const iciciCircuitBreaker = new CircuitBreaker(5, 60000);
