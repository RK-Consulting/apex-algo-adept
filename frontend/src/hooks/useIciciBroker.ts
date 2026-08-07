// frontend/src/hooks/useIciciBroker.ts
import { useState, useCallback } from 'react';
import { api } from '../lib/api';

export const useIciciBroker = () => {
  const [loading, setLoading] = useState(false);

  const getStatus = useCallback(async () => {
    const { data } = await api.get('/api/icici/status');
    return data; // Returns { connected, state, hasCredentials }
  }, []);

  const initiateConnection = async () => {
    setLoading(true);
    try {
      const { data } = await api.post('/api/icici/connect');
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      }
    } catch (err) {
      console.error("Broker Connection Failed", err);
    } finally {
      setLoading(false);
    }
  };

  return { initiateConnection, getStatus, loading };
};
