import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

const defaultWatchlist = ["NIFTY", "BANKNIFTY", "RELIANCE", "TCS", "INFY"];

export function Watchlist() {
  const navigate = useNavigate();
  const [watchlistData, setWatchlistData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchQuotes = async () => {
      try {
        const token = localStorage.getItem("authToken");
        if (!token) {
          setLoading(false);
          return;
        }

        const backendUrl = import.meta.env.VITE_BACKEND_URL;
        
        const quotes = await Promise.allSettled(
          defaultWatchlist.map(async (symbol) => {
            const response = await fetch(`${backendUrl}/api/icici/quote/${symbol}`, {
              headers: { "Authorization": `Bearer ${token}` },
            });
            
            if (!response.ok) throw new Error(`Failed to fetch ${symbol}`);
            
            const result = await response.json();
            const quoteData = result.quote?.Success?.[0] || {};
            
            return {
              symbol,
              price: parseFloat(quoteData.ltp || quoteData.LastPrice || 0).toFixed(2),
              change: parseFloat(quoteData.change || 0).toFixed(2),
              percent: parseFloat(quoteData.change_percent || 0).toFixed(2),
              trend: parseFloat(quoteData.change || 0) >= 0 ? "up" : "down",
            };
          })
        );

        const successfulQuotes = quotes
          .filter((result) => result.status === "fulfilled")
          .map((result: any) => result.value);

        setWatchlistData(successfulQuotes);
      } catch (error) {
        console.error("Error fetching watchlist:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchQuotes();
    const interval = setInterval(fetchQuotes, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-lg">Watchlist</CardTitle>
        <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
          <Plus className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <div className="text-center text-sm text-muted-foreground py-4">Loading...</div>
        ) : watchlistData.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-4">
            Connect to ICICI broker to view live data
          </div>
        ) : (
          watchlistData.map((item) => (
            <div
              key={item.symbol}
              onClick={() => navigate(`/stock/${item.symbol}`)}
              className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-all cursor-pointer border border-transparent hover:border-border"
            >
              <div>
                <div className="font-mono font-semibold text-sm">{item.symbol}</div>
                <div className="text-xs text-muted-foreground">NSE</div>
              </div>
              <div className="text-right">
                <div className="font-mono font-bold text-sm">₹{item.price}</div>
                <div
                  className={`flex items-center gap-1 text-xs font-medium ${
                    item.trend === "up" ? "text-success" : "text-destructive"
                  }`}
                >
                  {item.trend === "up" ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  <span>{item.change >= 0 ? '+' : ''}{item.change}</span>
                  <span className="text-[10px]">({item.percent >= 0 ? '+' : ''}{item.percent}%)</span>
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
