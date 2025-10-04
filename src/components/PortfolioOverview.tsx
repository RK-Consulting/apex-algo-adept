import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";

const holdings = [
  { symbol: "RELIANCE", qty: 50, avgPrice: "2,380.00", ltp: "2,456.70", pnl: "+3,835", percent: "+3.22%", trend: "up" },
  { symbol: "TCS", qty: 25, avgPrice: "3,850.00", ltp: "3,789.20", pnl: "-1,520", percent: "-1.58%", trend: "down" },
  { symbol: "INFY", qty: 75, avgPrice: "1,498.00", ltp: "1,567.45", pnl: "+5,209", percent: "+4.64%", trend: "up" },
  { symbol: "HDFCBANK", qty: 40, avgPrice: "1,645.00", ltp: "1,678.90", pnl: "+1,356", percent: "+2.06%", trend: "up" },
];

export function PortfolioOverview() {
  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Portfolio Holdings
          </CardTitle>
          <div className="text-sm">
            <span className="text-muted-foreground">Total P&L: </span>
            <span className="font-mono font-bold text-success">+₹8,945</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/30">
              <tr className="text-xs text-muted-foreground">
                <th className="text-left p-3 font-medium">Symbol</th>
                <th className="text-right p-3 font-medium">Qty</th>
                <th className="text-right p-3 font-medium">Avg Price</th>
                <th className="text-right p-3 font-medium">LTP</th>
                <th className="text-right p-3 font-medium">P&L</th>
                <th className="text-right p-3 font-medium">%</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((holding, index) => (
                <tr
                  key={holding.symbol}
                  className={`hover:bg-muted/20 transition-colors ${
                    index !== holdings.length - 1 ? "border-b border-border" : ""
                  }`}
                >
                  <td className="p-3">
                    <div className="font-mono font-semibold text-sm">{holding.symbol}</div>
                  </td>
                  <td className="p-3 text-right font-mono text-sm">{holding.qty}</td>
                  <td className="p-3 text-right font-mono text-sm text-muted-foreground">
                    ₹{holding.avgPrice}
                  </td>
                  <td className="p-3 text-right font-mono text-sm font-semibold">
                    ₹{holding.ltp}
                  </td>
                  <td
                    className={`p-3 text-right font-mono text-sm font-semibold ${
                      holding.trend === "up" ? "text-success" : "text-destructive"
                    }`}
                  >
                    ₹{holding.pnl}
                  </td>
                  <td className="p-3 text-right">
                    <div
                      className={`flex items-center justify-end gap-1 text-xs font-medium ${
                        holding.trend === "up" ? "text-success" : "text-destructive"
                      }`}
                    >
                      {holding.trend === "up" ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : (
                        <TrendingDown className="w-3 h-3" />
                      )}
                      <span>{holding.percent}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
