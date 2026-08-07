// frontend/src/api/axiosInstance.ts
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://api.alphaforge.in',
  withCredentials: true,
});

// Attach JWT to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Global Error Handler
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const { status, data } = error.response || {};

    if (status === 401) {
      // Identity session expired
      window.location.href = '/login';
    }

    if (status === 412 && data.code === 'ICICI_SESSION_REQUIRED') {
      // ICICI specific session expired - trigger reconnect modal
      window.dispatchEvent(new CustomEvent('icici-reconnect-required'));
    }

    return Promise.reject(error);
  }
);

export default api;
