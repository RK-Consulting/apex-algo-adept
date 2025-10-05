import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useMarketData = (symbols: { symbol: string; exchange: string }[]) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMarketData = async () => {
      try {
        setLoading(true);
        
        // Call the market-stream function
        const { data: marketData, error } = await supabase.functions.invoke('market-stream', {
          body: { symbols },
        });

        if (error) throw error;

        setData(marketData.data || []);
      } catch (error) {
        console.error('Error fetching market data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (symbols.length > 0) {
      fetchMarketData();
      
      // Refresh every 5 seconds
      const interval = setInterval(fetchMarketData, 5000);
      return () => clearInterval(interval);
    }
  }, [symbols]);

  return { data, loading };
};

// Generate mock historical data for charts
export const generateChartData = (symbol: string, basePrice: number) => {
  const data = [];
  const now = new Date();
  
  for (let i = 100; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 5 * 60 * 1000); // 5-minute intervals
    const randomChange = (Math.random() - 0.5) * (basePrice * 0.02);
    const price = basePrice + randomChange;
    
    data.push({
      time: time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      price: parseFloat(price.toFixed(2)),
      volume: Math.floor(Math.random() * 1000000 + 100000),
      rsi: Math.random() * 100,
      macd: (Math.random() - 0.5) * 10,
    });
  }
  
  return data;
};
