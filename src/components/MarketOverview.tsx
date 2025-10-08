import { TrendingUp, TrendingDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useMarketData } from "@/hooks/useMarketData";

const indexSymbols = [
  { symbol: "NIFTY", exchange: "NSE", name: "NIFTY 50" },
  { symbol: "SENSEX", exchange: "BSE", name: "SENSEX" },
  { symbol: "BANKNIFTY", exchange: "NSE", name: "NIFTY BANK" },
  { symbol: "INDIAVIX", exchange: "NSE", name: "INDIA VIX" },
];

export function MarketOverview() {
  const { data: marketData, loading } = useMarketData(indexSymbols);

  const getIndexData = (symbol: string) => {
    const liveData = marketData.find(d => d.symbol === symbol);
    return liveData || null;
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {indexSymbols.map((index) => {
        const liveData = getIndexData(index.symbol);
        const trend = liveData && liveData.change >= 0 ? "up" : "down";
        
        return (
          <Card
            key={index.symbol}
            className="p-4 bg-card border-border hover:border-primary/50 transition-all duration-300 cursor-pointer"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs text-muted-foreground mb-1">{index.name}</div>
                <div className="text-2xl font-mono font-bold mb-1">
                  {loading ? "..." : liveData ? liveData.price.toFixed(2) : "N/A"}
                </div>
                <div
                  className={`flex items-center gap-1 text-sm font-medium ${
                    trend === "up" ? "text-success" : "text-destructive"
                  }`}
                >
                  {trend === "up" ? (
                    <TrendingUp className="w-4 h-4" />
                  ) : (
                    <TrendingDown className="w-4 h-4" />
                  )}
                  <span>
                    {liveData ? `${liveData.change >= 0 ? '+' : ''}${liveData.change.toFixed(2)}` : "N/A"}
                  </span>
                  <span className="text-xs">
                    ({liveData ? `${liveData.change_percent >= 0 ? '+' : ''}${liveData.change_percent.toFixed(2)}%` : "N/A"})
                  </span>
                </div>
              </div>
              <div
                className={`w-2 h-2 rounded-full ${
                  trend === "up" ? "bg-success animate-pulse" : "bg-destructive animate-pulse"
                }`}
              />
            </div>
          </Card>
        );
      })}
    </div>
  );
}
