import { useState, useEffect } from "react";

export const useMarketData = (symbols: { symbol: string; exchange: string }[]) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMarketData = async () => {
      try {
        const token = localStorage.getItem("authToken");
        if (!token) {
          setLoading(false);
          return;
        }

        setLoading(true);
        const backendUrl = import.meta.env.VITE_BACKEND_URL;
        
        const quotes = await Promise.allSettled(
          symbols.map(async (symbolInfo) => {
            //const response = await fetch(`${backendUrl}/api/icici/quote/${symbolInfo.symbol}`, 
            const response = await fetch(`${backendUrl}/api/icici/market/quote?symbol=${symbolInfo.symbol}`, {
                             headers: { "Authorization": `Bearer ${token}` },
            });
            
            if (!response.ok) throw new Error(`Failed to fetch ${symbolInfo.symbol}`);
            
            const result = await response.json();
            const quoteData = result.quote?.Success?.[0] || {};
            
            return {
              symbol: symbolInfo.symbol,
              exchange: symbolInfo.exchange,
              price: parseFloat(quoteData.ltp || quoteData.LastPrice || 0),
              change: parseFloat(quoteData.change || 0),
              change_percent: parseFloat(quoteData.change_percent || 0),
              volume: parseInt(quoteData.volume || 0),
              open: parseFloat(quoteData.open || 0),
              high: parseFloat(quoteData.high || 0),
              low: parseFloat(quoteData.low || 0),
              previous_close: parseFloat(quoteData.prev_close || 0),
            };
          })
        );

        const successfulQuotes = quotes
          .filter((result) => result.status === "fulfilled")
          .map((result: any) => result.value);

        setData(successfulQuotes);
      } catch (error) {
        console.error('Error fetching market data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (symbols.length > 0) {
      fetchMarketData();
      
      // Refresh every 30 seconds
      const interval = setInterval(fetchMarketData, 30000);
      return () => clearInterval(interval);
    }
  }, [symbols]);

  return { data, loading };
};

