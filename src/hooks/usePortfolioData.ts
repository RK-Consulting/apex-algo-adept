// src/hooks/usePortfolioData.ts
import { useState, useEffect } from "react";

export const usePortfolioData = () => {
  const [portfolioData, setPortfolioData] = useState<any[]>([]);
  const [totalValue, setTotalValue] = useState(0);
  const [totalPnL, setTotalPnL] = useState(0);
  const [totalInvested, setTotalInvested] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPortfolio = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const token = localStorage.getItem("authToken");
        if (!token) {
          setError("Not authenticated");
          setLoading(false);
          return;
        }

        const backendUrl = import.meta.env.VITE_BACKEND_URL;
         // 🚨 TEMPORARY DISABLE ICICI CALL (backend failing)
        // const response = await fetch(`${backendUrl}/api/icici/portfolio`, {
          // headers: {
          //  "Authorization": `Bearer ${token}`,
          //},
       // });

        // if (!response.ok) 
          // throw new Error("Failed to fetch portfolio");
       // }

        // const result = await response.json();
        
        if (result.success && result.portfolio?.Success) {
          const holdings = result.portfolio.Success || [];
          
          const enrichedHoldings = holdings.map((holding: any) => {
            const avgPrice = parseFloat(holding.average_price || holding.AveragePrice || 0);
            const ltp = parseFloat(holding.ltp || holding.LastPrice || avgPrice);
            const qty = parseInt(holding.quantity || holding.Quantity || 0);
            const investedValue = avgPrice * qty;
            const currentValue = ltp * qty;
            const pnl = currentValue - investedValue;
            const pnlPercent = avgPrice > 0 ? ((ltp - avgPrice) / avgPrice) * 100 : 0;
            
            return {
              symbol: holding.stock_code || holding.StockCode || "",
              exchange: holding.exchange_code || holding.ExchangeCode || "NSE",
              quantity: qty,
              average_price: avgPrice,
              ltp,
              invested_value: investedValue,
              current_value: currentValue,
              pnl,
              pnlPercent,
              trend: pnl >= 0 ? "up" : "down",
            };
          });

          const totalVal = enrichedHoldings.reduce((sum: number, h: any) => sum + h.current_value, 0);
          const totalP = enrichedHoldings.reduce((sum: number, h: any) => sum + h.pnl, 0);
          const totalInv = enrichedHoldings.reduce((sum: number, h: any) => sum + h.invested_value, 0);

          setPortfolioData(enrichedHoldings);
          setTotalValue(totalVal);
          setTotalPnL(totalP);
          setTotalInvested(totalInv);
        } else {
          setPortfolioData([]);
          setTotalValue(0);
          setTotalPnL(0);
          setTotalInvested(0);
        }
      } catch (err) {
        console.error("Error fetching portfolio:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch portfolio");
        setPortfolioData([]);
      } finally {
        setLoading(false);
      }
    };

    // 🚨 DISABLE fetch ON LOAD
    // fetchPortfolio();
    // 🚨 DISABLE INTERVAL REFRESH
    // Refresh every 30 seconds
    //const interval = setInterval(fetchPortfolio, 30000);
    //return () => clearInterval(interval);
  }, []);

  return { holdings: portfolioData, totalValue, totalPnL, totalInvested, loading, error };
}; 
