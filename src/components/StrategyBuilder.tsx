import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Play, Plus, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const strategies = [
  {
    name: "Mean Reversion Pro",
    status: "active",
    performance: "+18.5%",
    trades: 142,
    winRate: "68%",
  },
  {
    name: "Momentum Breakout",
    status: "active",
    performance: "+24.3%",
    trades: 89,
    winRate: "71%",
  },
  {
    name: "AI Smart Grid",
    status: "paused",
    performance: "+12.1%",
    trades: 67,
    winRate: "65%",
  },
];

export function StrategyBuilder() {
  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-accent" />
            AI Strategy Builder
          </CardTitle>
          <Button variant="default" size="sm" className="gap-2">
            <Plus className="w-4 h-4" />
            Create Strategy
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* AI Suggestion Banner */}
        <div className="p-4 rounded-lg bg-gradient-to-r from-accent/10 to-primary/10 border border-accent/20">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-4 h-4 text-accent" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-sm mb-1">AI Recommendation</h4>
              <p className="text-xs text-muted-foreground mb-2">
                Based on current market conditions, consider adding a "Volatility Arbitrage" strategy
                for NIFTY options.
              </p>
              <Button size="sm" variant="outline" className="h-7 text-xs">
                View Strategy
              </Button>
            </div>
          </div>
        </div>

        {/* Active Strategies */}
        <div className="space-y-3">
          {strategies.map((strategy) => (
            <div
              key={strategy.name}
              className="p-4 rounded-lg bg-muted/30 border border-border hover:border-primary/50 transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-sm">{strategy.name}</h4>
                    <Badge
                      variant={strategy.status === "active" ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {strategy.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{strategy.trades} trades</span>
                    <span>Win rate: {strategy.winRate}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 text-success font-mono font-bold">
                    <TrendingUp className="w-4 h-4" />
                    {strategy.performance}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="h-8 text-xs flex-1">
                  <Play className="w-3 h-3 mr-1" />
                  {strategy.status === "active" ? "Pause" : "Resume"}
                </Button>
                <Button size="sm" variant="outline" className="h-8 text-xs flex-1">
                  View Details
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
