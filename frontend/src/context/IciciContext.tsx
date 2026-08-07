// frontend/src/context/IciciContext.tsx
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useIciciBroker } from '../hooks/useIciciBroker';

interface IciciContextType {
  isConnected: boolean;
  fsmState: string;
  refreshStatus: () => Promise<void>;
  loading: boolean;
}

const IciciContext = createContext<IciciContextType | undefined>(undefined);

export const IciciProvider = ({ children }: { children: ReactNode }) => {
  const { getStatus } = useIciciBroker();
  const [isConnected, setIsConnected] = useState(false);
  const [fsmState, setFsmState] = useState('IDLE');
  const [loading, setLoading] = useState(true);

  const refreshStatus = async () => {
    try {
      const status = await getStatus();
      setIsConnected(status.connected);
      setFsmState(status.state);
    } catch (err) {
      setIsConnected(false);
      setFsmState('FAILED');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshStatus();

    // Surgical: Listen for the interceptor's "Session Expired" event
    const handleReconnect = () => {
      setIsConnected(false);
      setFsmState('IDLE');
      // Optionally trigger a toast or notification here
    };

    window.addEventListener('icici-reconnect-required', handleReconnect);
    return () => window.removeEventListener('icici-reconnect-required', handleReconnect);
  }, []);

  return (
    <IciciContext.Provider value={{ isConnected, fsmState, refreshStatus, loading }}>
      {children}
    </IciciContext.Provider>
  );
};

export const useIcici = () => {
  const context = useContext(IciciContext);
  if (!context) throw new Error('useIcici must be used within an IciciProvider');
  return context;
};
