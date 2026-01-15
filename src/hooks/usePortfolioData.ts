// src/hooks/usePortfolioData.ts
import { useState, useEffect } from "react";
import { useIcici } from "@/context/IciciContext";

/**
 * Hook to manage portfolio data fetching and calculations.
 * Standardizes raw broker data into enriched UI-ready objects.
 */
export const usePortfolioData = () => {
  const [holdings, setHoldings] = useState<any[]>([]);
  const [totalValue, setTotalValue] = useState(0);
  const [totalPnL, setTotalPnL] = useState(0);
  const [totalInvested, setTotalInvested] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Get connection status from our FSM context
  const { isConnected } = useIcici();

  useEffect(() => {
    // 1. Safety Check: If broker isn't connected, don't even try the API
    if (!isConnected) {
      setLoading(false);
      setHoldings([]);
      setTotalValue(0);
      setTotalPnL(0);
      return;
    }

    const fetchPortfolio = async () => {
      try {
        setLoading(true);
        setError(null);

        const token = localStorage.getItem("auth_token") || localStorage.getItem("authToken");
        if (!token) {
          setError("Not authenticated");
          return;
        }

        const backendUrl = import.meta.env.VITE_BACKEND_URL || "https://api.alphaforge.skillsifter.in";

        // ✅ RE-ENABLED: Actual backend call
        const response = await fetch(`${backendUrl}/api/icici/portfolio`, {
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          },
        });

        if (!response.ok) throw new Error("Failed to fetch portfolio from server");

        const result = await response.json();

        // 2. Data Transformation Logic
        if (result.success && result.portfolio?.Success) {
          const rawHoldings = result.portfolio.Success || [];
          
          const enriched = rawHoldings.map((holding: any) => {
            const avgPrice = parseFloat(holding.average_price || holding.AveragePrice || 0);
            const ltp = parseFloat(holding.ltp || holding.LastPrice || avgPrice);
            const qty = parseInt(holding.quantity || holding.Quantity || 0);
            
            const investedValue = avgPrice * qty;
            const currentValue = ltp * qty;
            const pnl = currentValue - investedValue;

            return {
              symbol: holding.stock_code || holding.StockCode || "",
              exchange: holding.exchange_code || holding.ExchangeCode || "NSE",
              quantity: qty,
              average_price: avgPrice,
              ltp,
              invested_value: investedValue,
              current_value: currentValue,
              pnl,
              pnlPercent: avgPrice > 0 ? (pnl / investedValue) * 100 : 0,
              trend: pnl >= 0 ? "up" : "down",
            };
          });

          // 3. State Updates
          setHoldings(enriched);
          setTotalValue(enriched.reduce((sum, h) => sum + h.current_value, 0));
          setTotalPnL(enriched.reduce((sum, h) => sum + h.pnl, 0));
          setTotalInvested(enriched.reduce((sum, h) => sum + h.invested_value, 0));
        }
      } catch (err: any) {
        console.error("usePortfolioData Error:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchPortfolio();

    // 4. Polling: Refresh every 60s while the window is active
    const interval = setInterval(fetchPortfolio, 60000);
    return () => clearInterval(interval);

  }, [isConnected]); // Only re-run when broker connection status changes

  return { holdings, totalValue, totalPnL, totalInvested, loading, error };
};
