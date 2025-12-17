// backend/src/services/breezeClient.ts
/**
 * ICICI Breeze REST API Gateway - Institutional-Grade Custom Integration
 * 
 * Polish Applied:
 * - Strict error typing (unknown + axios.isAxiosError)
 * - Granular 401/403 handling for operator clarity
 * - X-Request-ID for centralized tracing (PM2 + Nginx logs)
 * - Debug-level logging (no production spam)
 * - CustomerDetails via POST (reliable)
 * - Explicit {} checksum for GET
 */

import axios, { AxiosError } from 'axios';
import { Agent } from 'https';
import crypto from 'crypto';
import { calculateChecksum, getTimestamp } from '../utils/breezeChecksum.js';
import { SessionService } from './sessionService.js';
import { retryWithBackoff } from '../utils/retry.js';
import { iciciCircuitBreaker } from '../utils/circuitBreaker.js';

const ICICI_BASE_URL = 'https://api.icicidirect.com/breezeapi';

// Connection pooling — ~50ms latency
const httpsAgent = new Agent({
  keepAlive: true,
  maxSockets: 50,
  maxFreeSockets: 10,
  timeout: 60000,
  keepAliveMsecs: 30000
});

const breezeAxios = axios.create({
  baseURL: ICICI_BASE_URL,
  httpsAgent,
  timeout: 30000,
  maxRedirects: 5,
  headers: { "Content-Type": "application/json" }
});

export async function breezeRequest<T = any>(
  userId: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  endpoint: string,
  payload: Record<string, any> = {}
): Promise<T> {
  const startTime = Date.now();
  const requestId = crypto.randomUUID(); // Observability

  if (process.env.NODE_ENV !== 'production') {
    console.debug(`[Breeze] ${method} ${endpoint} - User: ${userId} - ReqID: ${requestId}`);
  }

  try {
    const session = await SessionService.getInstance().getSession(userId);
    if (!session || !session.api_key || !session.api_secret || !session.session_token) {
      throw new Error('ICICI not connected or invalid session.');
    }

    // CustomerDetails — POST (reliable across infrastructure)
    if (endpoint.includes('customerdetails')) {
      const response = await iciciCircuitBreaker.execute(() =>
        retryWithBackoff(() =>
          breezeAxios.post(endpoint, {
            //SessionToken: payload.SessionToken || session.apisession,
            SessionToken: payload.SessionToken,
            AppKey: session.api_key
          })
        )
      );

      if (response.data.Status !== 200) {
        throw new Error(`CustomerDetails error: ${response.data.Error || 'Unknown'}`);
      }
      return response.data;
    }

    const timestamp = getTimestamp();
    const checksumPayload = method === 'GET' ? {} : payload;
    const checksum = calculateChecksum(timestamp, checksumPayload, session.api_secret);

    const headers = {
      'X-Timestamp': timestamp,
      'X-AppKey': session.api_key,
      'X-SessionToken': session.session_token,
      'X-Checksum': `token ${checksum}`,
      'X-Request-ID': requestId // Tracing
    };

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

    if (response.data.Status && response.data.Status !== 200) {
      throw new Error(`Breeze API error: ${response.data.Error || 'Unknown'}`);
    }

    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[Breeze] ${method} ${endpoint} - Success (${Date.now() - startTime}ms) - ReqID: ${requestId}`);
    }
    return response.data;
  } catch (error: unknown) {
    const axiosError = error as AxiosError;

    if (axios.isAxiosError(axiosError)) {
      const status = axiosError.response?.status;
      const data = axiosError.response?.data as any;

      if (status === 401) {
        await SessionService.getInstance().invalidateSession(userId);
        throw new Error('ICICI session expired. Please reconnect to Breeze.');
      }

      if (status === 403) {
        throw new Error(
          'ICICI access denied (403). Possible causes:\n' +
          '• Server IP not whitelisted in ICICI portal\n' +
          '• Invalid or expired API credentials\n' +
          '• Checksum calculation error\n' +
          '• Session token invalid'
        );
      }
    }

    throw error;
  }
}

// Convenience wrappers unchanged
// getCustomerDetails, placeOrder, getOrders, etc.

// Login URL
export function getBreezeLoginUrl(apiKey: string): string {
  return `https://api.icicidirect.com/apiuser/login?api_key=${encodeURIComponent(apiKey)}`;
}

// CustomerDetails helper (used only during auth flow)
export async function getCustomerDetails(
  userId: string,
  apisession: string
) {
  return breezeRequest(userId, "POST", "/api/v1/customerdetails", {
    SessionToken: apisession,
  });
}
