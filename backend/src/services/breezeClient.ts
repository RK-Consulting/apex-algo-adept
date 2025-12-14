//
// ICICI logic and checksum calculation moved here, retry logi, circuit breaker, connection pooling (HTTPS Agent with keepAlive)
// backend/src/services/breezeClient.ts
import axios from 'axios';
import { Agent } from 'https';
import { calculateChecksum, getTimestamp } from '../utils/breezeChecksum';
import { SessionService } from './sessionService';
import { retryWithBackoff } from '../utils/retry';
import { iciciCircuitBreaker } from '../utils/circuitBreaker';
import { getCachedQuote, cacheQuote } from './cache';

const ICICI_BASE_URL = 'https://api.icicidirect.com/breezeapi';

// Connection pooling - reuse connections
const httpsAgent = new Agent({
  keepAlive: true,
  maxSockets: 50,
  maxFreeSockets: 10,
  timeout: 60000
});

const breezeAxios = axios.create({
  baseURL: ICICI_BASE_URL,
  httpsAgent,
  timeout: 30000
});

/**
 * MAIN FUNCTION - All ICICI API calls go through here
 */
export async function breezeRequest<T = any>(
  userId: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  endpoint: string,
  payload: Record<string, any> = {}
): Promise<T> {
  try {
    // 1. Get user's session from cache/database
    const session = await SessionService.getInstance().getSession(userId);
    
    if (!session) {
      throw new Error('ICICI not connected. Please authenticate first.');
    }

    // 2. Special case: CustomerDetails API (different format)
    if (endpoint.includes('customerdetails')) {
      const response = await breezeAxios.get(endpoint, {
        headers: { 'Content-Type': 'application/json' },
        data: JSON.stringify({
          SessionToken: payload.SessionToken || session.apisession,
          AppKey: session.api_key
        })
      });
      return response.data;
    }

    // 3. For all other endpoints: calculate checksum
    const timestamp = getTimestamp();
    const checksum = calculateChecksum(timestamp, payload, session.api_secret);

    // 4. Build headers
    const headers = {
      'Content-Type': 'application/json',
      'X-Timestamp': timestamp,
      'X-AppKey': session.api_key,
      'X-SessionToken': session.session_token,
      'X-Checksum': `token ${checksum}`
    };

    // 5. Execute with retry + circuit breaker
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

    return response.data;

  } catch (error: any) {
    // Handle errors
    if (error.response?.status === 403) {
      throw new Error('ICICI API access denied. Check IP whitelist and credentials.');
    }
    if (error.response?.status === 401) {
      throw new Error('ICICI session expired. Please reconnect.');
    }
    throw error;
  }
}

/**
 * CONVENIENCE METHODS - Easy to use wrappers
 */

export async function getCustomerDetails(userId: string, apisession: string, apiKey: string) {
  return breezeRequest(userId, 'GET', '/api/v1/customerdetails', {
    SessionToken: apisession
  });
}

export async function placeOrder(userId: string, orderData: any) {
  return breezeRequest(userId, 'POST', '/api/v1/order', orderData);
}

export async function getOrders(userId: string, exchangeCode: string, fromDate: string, toDate: string) {
  return breezeRequest(userId, 'GET', '/api/v1/order', {
    exchange_code: exchangeCode,
    from_date: fromDate,
    to_date: toDate
  });
}

export async function cancelOrder(userId: string, exchangeCode: string, orderId: string) {
  return breezeRequest(userId, 'DELETE', '/api/v1/order', {
    exchange_code: exchangeCode,
    order_id: orderId
  });
}

export async function getPortfolioPositions(userId: string) {
  return breezeRequest(userId, 'GET', '/api/v1/portfoliopositions', {});
}

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
  if (cached) return cached;

  const result = await breezeRequest(userId, 'GET', '/api/v1/quotes', params);
  
  // Cache for 5 seconds
  await cacheQuote(params.stock_code, result);
  
  return result;
}

export async function getFunds(userId: string) {
  return breezeRequest(userId, 'GET', '/api/v1/funds', {});
}

export async function getMargins(userId: string, exchangeCode: string) {
  return breezeRequest(userId, 'GET', '/api/v1/margin', {
    exchange_code: exchangeCode
  });
}
