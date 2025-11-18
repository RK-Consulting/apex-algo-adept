import { authService } from './authService';

const API_URL = import.meta.env.VITE_API_URL || 'https://api.alphaforge.skillsifter.in';

class ApiService {
  private async fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
    const token = authService.getToken();
    
    if (!token) {
      throw new Error('No authentication token found');
    }

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 401 || response.status === 403) {
      authService.clearToken();
      window.location.href = '/login';
      throw new Error('Invalid or expired token');
    }

    return response;
  }

  async getStrategies(): Promise<any> {
    try {
      const response = await this.fetchWithAuth(`${API_URL}/api/strategies`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch strategies: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching strategies:', error);
      throw error;
    }
  }

  async getQuote(symbol: string): Promise<any> {
    try {
      const response = await this.fetchWithAuth(
        `${API_URL}/api/icici/quote/${encodeURIComponent(symbol)}`
      );
      
      if (!response.ok) {
        if (response.status === 500) {
          console.warn(`Quote service unavailable for ${symbol}`);
          return null;
        }
        throw new Error(`Failed to fetch quote for ${symbol}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Error fetching quote for ${symbol}:`, error);
      return null;
    }
  }

  async getQuotes(symbols: string[]): Promise<Map<string, any>> {
    const quotes = new Map<string, any>();
    
    const results = await Promise.allSettled(
      symbols.map(symbol => this.getQuote(symbol))
    );

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        quotes.set(symbols[index], result.value);
      }
    });

    return quotes;
  }
}

export const apiService = new ApiService();
export default apiService;
