const API_URL = import.meta.env.VITE_API_URL || 'https://api.alphaforge.skillsifter.in';

interface AuthResponse {
  token: string;
  user?: any;
}

class AuthService {
  private tokenKey = 'auth_token';
  private tokenExpiryKey = 'token_expiry';

  setToken(token: string, expiryInHours: number = 24): void {
    localStorage.setItem(this.tokenKey, token);
    const expiry = new Date().getTime() + (expiryInHours * 60 * 60 * 1000);
    localStorage.setItem(this.tokenExpiryKey, expiry.toString());
  }

  getToken(): string | null {
    const token = localStorage.getItem(this.tokenKey);
    const expiry = localStorage.getItem(this.tokenExpiryKey);
    
    if (!token || !expiry) {
      return null;
    }

    if (new Date().getTime() > parseInt(expiry)) {
      this.clearToken();
      return null;
    }

    return token;
  }

  clearToken(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.tokenExpiryKey);
  }

  async login(username: string, password: string): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Login failed' }));
        throw new Error(error.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data: AuthResponse = await response.json();
      
      if (data.token) {
        this.setToken(data.token);
      }

      return data;
    } catch (error) {
      console.error('[AuthService] Login error:', error);
      throw error;
    }
  }

  async verifyToken(): Promise<boolean> {
    const token = this.getToken();
    
    if (!token) {
      return false;
    }

    try {
      const response = await fetch(`${API_URL}/api/auth/verify`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        this.clearToken();
        return false;
      }

      return true;
    } catch (error) {
      console.error('[AuthService] Token verification error:', error);
      this.clearToken();
      return false;
    }
  }

  logout(): void {
    this.clearToken();
    window.location.href = '/login';
  }
}

export const authService = new AuthService();
export default authService;
