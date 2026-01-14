// frontend/src/services/iciciService.ts
import api from '../api/axiosInstance';

export interface IciciStatus {
  connected: boolean;
  state: 'IDLE' | 'LOGIN_INITIATED' | 'CALLBACK_RECEIVED' | 'SESSION_ACTIVE' | 'FAILED' | 'LOCKED';
  hasCredentials: boolean;
  lastConnected: string | null;
}

export const iciciService = {
  /**
   * Fetches the detailed FSM state from the backend
   */
  async getStatus(): Promise<IciciStatus> {
    const { data } = await api.get('/api/icici/status');
    return data;
  },

  /**
   * Starts the connection flow (IDLE -> LOGIN_INITIATED)
   */
  async connect(): Promise<string> {
    const { data } = await api.post('/api/icici/connect');
    if (data.redirectUrl) {
      return data.redirectUrl;
    }
    throw new Error('Failed to get login URL');
  },

  /**
   * Realtime Subscription (The Aggregator Feed)
   */
  async subscribe(symbol: string, exchange = 'NSE') {
    return api.post('/api/icici/stream/subscribe', { symbol, exchange });
  },

  async unsubscribe(symbol: string, exchange = 'NSE') {
    return api.post('/api/icici/stream/unsubscribe', { symbol, exchange });
  }
};
