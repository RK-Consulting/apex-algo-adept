// backend/src/utils/retry.ts

/**
 * Retry a function with exponential backoff
 * Only retries on network errors, not business logic errors
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      // Only retry on network/server errors
      const err = error as { code?: string; response?: { status?: number } };
      const shouldRetry = 
        err.code === 'ECONNRESET' || 
        err.code === 'ETIMEDOUT' ||
        err.code === 'ENOTFOUND' ||
        (err.response?.status ?? 0) >= 500;

      if (!shouldRetry || attempt === maxRetries - 1) {
        throw error; // Don't retry or max retries reached
      }

      // Calculate delay with exponential backoff
      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`[Retry] Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new Error('Max retries exceeded');
}
