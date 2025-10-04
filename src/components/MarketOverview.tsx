import { TrendingUp, TrendingDown } from "lucide-react";
import { Card } from "@/components/ui/card";

const marketIndices = [
  { name: "NIFTY 50", value: "21,453.25", change: "+245.80", percent: "+1.16%", trend: "up" },
  { name: "SENSEX", value: "71,283.45", change: "+823.45", percent: "+1.17%", trend: "up" },
  { name: "NIFTY BANK", value: "46,789.30", change: "-127.65", percent: "-0.27%", trend: "down" },
  { name: "INDIA VIX", value: "12.45", change: "-0.85", percent: "-6.39%", trend: "down" },
];

export function MarketOverview() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {marketIndices.map((index) => (
        <Card
          key={index.name}
          className="p-4 bg-card border-border hover:border-primary/50 transition-all duration-300 cursor-pointer"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs text-muted-foreground mb-1">{index.name}</div>
              <div className="text-2xl font-mono font-bold mb-1">{index.value}</div>
              <div
                className={`flex items-center gap-1 text-sm font-medium ${
                  index.trend === "up" ? "text-success" : "text-destructive"
                }`}
              >
                {index.trend === "up" ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                <span>{index.change}</span>
                <span className="text-xs">({index.percent})</span>
              </div>
            </div>
            <div
              className={`w-2 h-2 rounded-full ${
                index.trend === "up" ? "bg-success animate-pulse" : "bg-destructive animate-pulse"
              }`}
            />
          </div>
        </Card>
      ))}
    </div>
  );
}
