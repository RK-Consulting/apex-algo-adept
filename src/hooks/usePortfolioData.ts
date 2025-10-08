import { useState, useEffect } from "react";
import { useMarketData } from "./useMarketData";

// Mock portfolio holdings - in a real app, this would come from a database
const mockHoldings = [
  { symbol: "RELIANCE", exchange: "NSE", qty: 50, avgPrice: 2380.00 },
  { symbol: "TCS", exchange: "NSE", qty: 25, avgPrice: 3850.00 },
  { symbol: "INFY", exchange: "NSE", qty: 75, avgPrice: 1498.00 },
  { symbol: "HDFCBANK", exchange: "NSE", qty: 40, avgPrice: 1645.00 },
];

export const usePortfolioData = () => {
  const symbols = mockHoldings.map(h => ({ symbol: h.symbol, exchange: h.exchange }));
  const { data: marketData, loading } = useMarketData(symbols);
  const [portfolioData, setPortfolioData] = useState<any[]>([]);
  const [totalValue, setTotalValue] = useState(0);
  const [totalPnL, setTotalPnL] = useState(0);

  useEffect(() => {
    if (marketData.length > 0) {
      const enrichedHoldings = mockHoldings.map(holding => {
        const liveData = marketData.find(d => d.symbol === holding.symbol);
        const ltp = liveData?.price || holding.avgPrice;
        const pnl = (ltp - holding.avgPrice) * holding.qty;
        const pnlPercent = ((ltp - holding.avgPrice) / holding.avgPrice) * 100;
        
        return {
          ...holding,
          ltp,
          pnl,
          pnlPercent,
          trend: pnl >= 0 ? "up" : "down",
        };
      });

      const totalVal = enrichedHoldings.reduce((sum, h) => sum + (h.ltp * h.qty), 0);
      const totalP = enrichedHoldings.reduce((sum, h) => sum + h.pnl, 0);

      setPortfolioData(enrichedHoldings);
      setTotalValue(totalVal);
      setTotalPnL(totalP);
    }
  }, [marketData]);

  return { holdings: portfolioData, totalValue, totalPnL, loading };
};
