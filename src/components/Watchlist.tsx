import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

const watchlistItems = [
  { symbol: "RELIANCE", price: "2,456.70", change: "+23.45", percent: "+0.96%", trend: "up" },
  { symbol: "TCS", price: "3,789.20", change: "-12.30", percent: "-0.32%", trend: "down" },
  { symbol: "INFY", price: "1,567.45", change: "+45.60", percent: "+2.99%", trend: "up" },
  { symbol: "HDFCBANK", price: "1,678.90", change: "+8.75", percent: "+0.52%", trend: "up" },
  { symbol: "ICICIBANK", price: "987.35", change: "-5.20", percent: "-0.52%", trend: "down" },
];

export function Watchlist() {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-lg">Watchlist</CardTitle>
        <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
          <Plus className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {watchlistItems.map((item) => (
          <div
            key={item.symbol}
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
                <span>{item.change}</span>
                <span className="text-[10px]">({item.percent})</span>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
