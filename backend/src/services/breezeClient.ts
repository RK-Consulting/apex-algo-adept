// backend/src/services/breezeClient.ts
// ICICI Breeze API Gateway - All ICICI API calls go through here
// Features: Connection pooling, retry logic, circuit breaker, caching, rate limiting
import BreezeConnect from "breezeconnect"; // Ensure you have: npm install breezeconnect
import axios, { AxiosError } from 'axios';
import { Agent } from 'https';
import { calculateChecksum, getTimestamp } from '../utils/breezeChecksum';
import { SessionService } from './sessionService';
import { retryWithBackoff } from '../utils/retry';
import { iciciCircuitBreaker } from '../utils/circuitBreaker';
import { getCachedQuote, cacheQuote } from './cache';

const ICICI_BASE_URL = 'https://api.icicidirect.com/breezeapi';

// ICICI API rate limits: 100 calls/minute per user, 5000 calls/day
const RATE_LIMIT_PER_MINUTE = 100;
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute

// Track API calls per user for rate limiting
const userRateLimits = new Map<string, { count: number; resetAt: number }>();

/**
 * Connection pooling - reuse TCP connections for performance
 * Without this: ~200ms per request (new connection each time)
 * With this: ~50ms per request (reuse existing connections)
 */
const httpsAgent = new Agent({
  keepAlive: true,
  maxSockets: 50,           // Max concurrent connections
  maxFreeSockets: 10,       // Keep 10 connections open
  timeout: 60000,           // Socket timeout
  keepAliveMsecs: 30000     // Keep connection alive for 30s
});

/**
 * Configured axios instance with connection pooling
 */
const breezeAxios = axios.create({
  baseURL: ICICI_BASE_URL,
  httpsAgent,
  timeout: 30000,           // 30 second request timeout
  maxRedirects: 5
});

/**
 * Check if user has exceeded ICICI API rate limit
 */
function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const limit = userRateLimits.get(userId);

  if (!limit || now > limit.resetAt) {
    // Reset counter if window expired
    userRateLimits.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (limit.count >= RATE_LIMIT_PER_MINUTE) {
    console.warn(`[Breeze] Rate limit exceeded for user ${userId}: ${limit.count} calls in last minute`);
    return false;
  }

  // Increment counter
  limit.count++;
  return true;
}

/**
 * MAIN FUNCTION - All ICICI API calls go through here
 * 
 * Features:
 * - Session management (from cache/database)
 * - Rate limiting (100 calls/minute per user)
 * - Checksum calculation
 * - Retry logic (3 attempts with exponential backoff)
 * - Circuit breaker (opens after 5 failures)
 * - Connection pooling (reuse TCP connections)
 * - Comprehensive error handling
 */
export async function breezeRequest<T = any>(
  userId: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  endpoint: string,
  payload: Record<string, any> = {}
): Promise<T> {
  const startTime = Date.now();
  
  try {
    console.log(`[Breeze] ${method} ${endpoint} - User: ${userId} - Started`);

    // 1. Check rate limit
    if (!checkRateLimit(userId)) {
      throw new Error(
        `Rate limit exceeded. ICICI API allows ${RATE_LIMIT_PER_MINUTE} calls per minute. ` +
        `Please wait before making more requests.`
      );
    }

    // 2. Get user's session from cache/database
    const session = await SessionService.getInstance().getSession(userId);
    
    if (!session) {
      throw new Error(
        'ICICI not connected. Please authenticate with ICICI Breeze first.'
      );
    }

    // Validate session has required fields
    if (!session.api_key || !session.api_secret) {
      throw new Error(
        'Invalid session: missing API credentials. Please reconnect to ICICI.'
      );
    }

    // 3. Special case: CustomerDetails API (different authentication flow)
    if (endpoint.includes('customerdetails')) {
      console.log(`[Breeze] Calling CustomerDetails API (special auth flow)`);
      
      const response = await iciciCircuitBreaker.execute(() =>
        retryWithBackoff(() =>
          breezeAxios.get(endpoint, {
            headers: { 'Content-Type': 'application/json' },
            data: JSON.stringify({
              SessionToken: payload.SessionToken || session.apisession,
              AppKey: session.api_key
            })
          })
        )
      );

      // Check for API-level errors
      if (response.data.Status !== 200) {
        throw new Error(
          `CustomerDetails API error: ${response.data.Error || 'Unknown error'}`
        );
      }

      console.log(`[Breeze] CustomerDetails API - Success (${Date.now() - startTime}ms)`);
      return response.data;
    }

    // 4. For all other endpoints: calculate checksum
    const timestamp = getTimestamp();
    const checksum = calculateChecksum(timestamp, payload, session.api_secret);

    // 5. Build headers with authentication
    const headers = {
      'Content-Type': 'application/json',
      'X-Timestamp': timestamp,
      'X-AppKey': session.api_key,
      'X-SessionToken': session.session_token,
      'X-Checksum': `token ${checksum}`
    };

    // 6. Execute with retry + circuit breaker
    const response = await iciciCircuitBreaker.execute(() =>
      retryWithBackoff(() =>
        breezeAxios({
          method,
          url: endpoint,
          data: payload,
          headers
        })
      )
    );

    // 7. Check for API-level errors (even with 200 HTTP status)
    if (response.data.Status && response.data.Status !== 200) {
      throw new Error(
        `Breeze API error (Status ${response.data.Status}): ${response.data.Error || 'Unknown error'}`
      );
    }

    const duration = Date.now() - startTime;
    console.log(`[Breeze] ${method} ${endpoint} - Success (${duration}ms)`);

    return response.data;

  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    // Enhanced error handling with specific messages
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      
      if (axiosError.response) {
        const status = axiosError.response.status;
        const data = axiosError.response.data as any;

        console.error(
          `[Breeze] ${method} ${endpoint} - HTTP ${status} (${duration}ms)`,
          data
        );

        // Map HTTP status codes to user-friendly messages
        switch (status) {
          case 400:
            throw new Error(
              `Bad request: ${data.Error || data.error || 'Invalid parameters'}`
            );
          
          case 401:
            // Session expired - invalidate cache
            await SessionService.getInstance().invalidateSession(userId);
            throw new Error(
              'ICICI session expired. Please reconnect to ICICI Breeze.'
            );
          
          case 403:
            throw new Error(
              'ICICI API access denied. Possible causes:\n' +
              '1. Server IP not whitelisted in ICICI portal\n' +
              '2. Invalid API credentials\n' +
              '3. Incorrect checksum calculation\n' +
              '4. Session expired or invalid'
            );
          
          case 408:
            throw new Error(
              'Request timeout. Your system time may be out of sync with ICICI server ' +
              '(must be within 60 seconds). Check server time with: date'
            );
          
          case 429:
            throw new Error(
              'Too many requests. ICICI API rate limit exceeded. ' +
              `Please wait before making more requests.`
            );
          
          case 500:
          case 502:
          case 503:
          case 504:
            throw new Error(
              `ICICI API server error (${status}). This is on ICICI's side. ` +
              'Please try again in a few minutes.'
            );
          
          default:
            throw new Error(
              `ICICI API error (HTTP ${status}): ${data.Error || data.error || error.message}`
            );
        }
      }

      // Network errors (no response)
      if (axiosError.code === 'ECONNABORTED') {
        throw new Error(
          'Request timeout. ICICI API is taking too long to respond. Please try again.'
        );
      }
      
      if (axiosError.code === 'ENOTFOUND' || axiosError.code === 'ECONNREFUSED') {
        throw new Error(
          'Cannot connect to ICICI API. Check your internet connection or ' +
          'ICICI API may be down.'
        );
      }
    }

    // Circuit breaker errors
    if (error.message?.includes('Circuit breaker')) {
      console.error(
        `[Breeze] ${method} ${endpoint} - Circuit breaker open (${duration}ms)`
      );
      throw new Error(
        'ICICI API is temporarily unavailable due to repeated failures. ' +
        'The system will automatically retry in 60 seconds.'
      );
    }

    // Rate limit errors
    if (error.message?.includes('Rate limit')) {
      console.error(
        `[Breeze] ${method} ${endpoint} - Rate limit exceeded (${duration}ms)`
      );
      throw error; // Already has good message
    }

    // Unknown errors
    console.error(
      `[Breeze] ${method} ${endpoint} - Unknown error (${duration}ms):`,
      error.message
    );
    
    throw new Error(
      `ICICI API request failed: ${error.message || 'Unknown error'}`
    );
  }
}

/**
 * ========================================================================
 * CONVENIENCE METHODS - Typed wrappers for common operations
 * ========================================================================
 */

/**
 * Get customer details (used after OAuth login to get session_token)
 */
export async function getCustomerDetails(
  userId: string,
  apisession: string,
  apiKey: string
) {
  return breezeRequest(userId, 'GET', '/api/v1/customerdetails', {
    SessionToken: apisession
  });
}

/**
 * Place a new order
 */
export async function placeOrder(userId: string, orderData: {
  stock_code: string;
  exchange_code: string;
  product: string;
  action: string;
  order_type: string;
  quantity: string;
  price: string;
  validity: string;
  stoploss?: string;
  disclosed_quantity?: string;
  expiry_date?: string;
  right?: string;
  strike_price?: string;
  user_remark?: string;
}) {
  return breezeRequest(userId, 'POST', '/api/v1/order', orderData);
}

/**
 * Get order list within date range
 */
export async function getOrders(
  userId: string,
  exchangeCode: string,
  fromDate: string,
  toDate: string
) {
  return breezeRequest(userId, 'GET', '/api/v1/order', {
    exchange_code: exchangeCode,
    from_date: fromDate,
    to_date: toDate
  });
}

/**
 * Get single order details by ID
 */
export async function getOrderDetail(
  userId: string,
  exchangeCode: string,
  orderId: string
) {
  return breezeRequest(userId, 'GET', '/api/v1/order', {
    exchange_code: exchangeCode,
    order_id: orderId
  });
}

/**
 * Cancel an order
 */
export async function cancelOrder(
  userId: string,
  exchangeCode: string,
  orderId: string
) {
  return breezeRequest(userId, 'DELETE', '/api/v1/order', {
    exchange_code: exchangeCode,
    order_id: orderId
  });
}

/**
 * Modify an existing order
 */
export async function modifyOrder(userId: string, modifyData: {
  order_id: string;
  exchange_code: string;
  quantity?: string;
  price?: string;
  stoploss?: string;
  disclosed_quantity?: string;
  order_type?: string;
  validity?: string;
}) {
  return breezeRequest(userId, 'PUT', '/api/v1/order', modifyData);
}

/**
 * Get portfolio positions
 */
export async function getPortfolioPositions(userId: string) {
  return breezeRequest(userId, 'GET', '/api/v1/portfoliopositions', {});
}

/**
 * Get portfolio holdings
 */
export async function getPortfolioHoldings(
  userId: string,
  exchangeCode: string,
  fromDate?: string,
  toDate?: string,
  stockCode?: string
) {
  return breezeRequest(userId, 'GET', '/api/v1/portfolioholdings', {
    exchange_code: exchangeCode,
    from_date: fromDate || '',
    to_date: toDate || '',
    stock_code: stockCode || '',
    portfolio_type: ''
  });
}

/**
 * Get live quotes for a stock (with 5-second cache)
 */
export async function getQuotes(userId: string, params: {
  stock_code: string;
  exchange_code: string;
  product_type: string;
  expiry_date?: string;
  right?: string;
  strike_price?: string;
}) {
  // Check cache first (5 second cache)
  const cached = await getCachedQuote(params.stock_code);
  if (cached) {
    console.log(`[Breeze] Quote cache HIT for ${params.stock_code}`);
    return cached;
  }

  console.log(`[Breeze] Quote cache MISS for ${params.stock_code}, fetching...`);
  const result = await breezeRequest(userId, 'GET', '/api/v1/quotes', params);
  
  // Cache for 5 seconds
  await cacheQuote(params.stock_code, result);
  
  return result;
}

/**
 * Get available funds
 */
export async function getFunds(userId: string) {
  return breezeRequest(userId, 'GET', '/api/v1/funds', {});
}

/**
 * Get margin information
 */
export async function getMargins(userId: string, exchangeCode: string) {
  return breezeRequest(userId, 'GET', '/api/v1/margin', {
    exchange_code: exchangeCode
  });
}

/**
 * Calculate margin requirements for positions
 */
export async function calculateMargin(
  userId: string,
  positions: any[],
  exchangeCode: string
) {
  return breezeRequest(userId, 'POST', '/api/v1/margincalculator', {
    list_of_positions: positions,
    exchange_code: exchangeCode
  });
}

/**
 * Get historical chart data
 */
export async function getHistoricalCharts(userId: string, params: {
  interval: string;
  from_date: string;
  to_date: string;
  stock_code: string;
  exchange_code: string;
  product_type: string;
  expiry_date?: string;
  right?: string;
  strike_price?: string;
}) {
  return breezeRequest(userId, 'GET', '/api/v1/historicalcharts', params);
}

/**
 * Square off a position
 */
export async function squareOff(userId: string, squareOffData: {
  source_flag?: string;
  stock_code: string;
  exchange_code: string;
  quantity: string;
  price: string;
  action: string;
  order_type: string;
  validity: string;
  stoploss_price?: string;
  disclosed_quantity?: string;
  product_type: string;
  expiry_date?: string;
  right?: string;
  strike_price?: string;
}) {
  return breezeRequest(userId, 'POST', '/api/v1/squareoff', squareOffData);
}

/**
 * Get trade list
 */
export async function getTradeList(
  userId: string,
  exchangeCode: string,
  fromDate: string,
  toDate: string
) {
  return breezeRequest(userId, 'GET', '/api/v1/trades', {
    exchange_code: exchangeCode,
    from_date: fromDate,
    to_date: toDate
  });
}

/**
 * Get demat holdings
 */
export async function getDematHoldings(userId: string) {
  return breezeRequest(userId, 'GET', '/api/v1/dematholdings', {});
}

/**
 * Helper: Build ICICI Breeze login URL
 */
export function getBreezeLoginUrl(apiKey: string): string {
  return `https://api.icicidirect.com/apiuser/login?api_key=${encodeURIComponent(apiKey)}`;
}

/**
 * Returns a configured BreezeConnect instance using session data
 * Used by iciciRealtime.ts for WebSocket connection
 */
export function getBreezeInstance(session: any): any {
  const breeze = new BreezeConnect({
    appKey: session.api_key,
  });
  breeze.setSessionToken(session.session_token);
  return breeze;
}
