import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";
import { usePortfolioData } from "@/hooks/usePortfolioData";

export function PortfolioOverview() {
  const { holdings, totalPnL, loading } = usePortfolioData();

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
            <span className={`font-mono font-bold ${totalPnL >= 0 ? 'text-success' : 'text-destructive'}`}>
              {totalPnL >= 0 ? '+' : ''}₹{totalPnL.toFixed(2)}
            </span>
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
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-3 text-center text-muted-foreground">
                    Loading portfolio data...
                  </td>
                </tr>
              ) : holdings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-3 text-center text-muted-foreground">
                    No holdings yet
                  </td>
                </tr>
              ) : (
                holdings.map((holding, index) => (
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
                      ₹{holding.avgPrice.toFixed(2)}
                    </td>
                    <td className="p-3 text-right font-mono text-sm font-semibold">
                      ₹{holding.ltp.toFixed(2)}
                    </td>
                    <td
                      className={`p-3 text-right font-mono text-sm font-semibold ${
                        holding.trend === "up" ? "text-success" : "text-destructive"
                      }`}
                    >
                      {holding.pnl >= 0 ? '+' : ''}₹{holding.pnl.toFixed(2)}
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
                        <span>{holding.pnlPercent >= 0 ? '+' : ''}{holding.pnlPercent.toFixed(2)}%</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
