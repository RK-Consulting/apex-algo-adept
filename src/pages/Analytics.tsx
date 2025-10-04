import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, TrendingUp, Target, Activity, PieChart, LineChart } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const Analytics = () => {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <div className="container mx-auto p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  Analytics Dashboard
                </h1>
                <p className="text-muted-foreground text-sm">Performance metrics and insights</p>
              </div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-card border-border">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-success" />
                    </div>
                    <Badge variant="outline" className="text-success">+12.5%</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground mb-1">Total Return</div>
                  <div className="text-2xl font-mono font-bold">₹1,45,678</div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Target className="w-5 h-5 text-primary" />
                    </div>
                    <Badge variant="outline">289 trades</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground mb-1">Win Rate</div>
                  <div className="text-2xl font-mono font-bold">68.5%</div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                      <Activity className="w-5 h-5 text-accent" />
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground mb-1">Sharpe Ratio</div>
                  <div className="text-2xl font-mono font-bold">1.85</div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <BarChart3 className="w-5 h-5 text-primary" />
                    </div>
                    <Badge variant="outline" className="text-destructive">-4.2%</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground mb-1">Max Drawdown</div>
                  <div className="text-2xl font-mono font-bold">-8.3%</div>
                </CardContent>
              </Card>
            </div>

            {/* Charts Placeholders */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <LineChart className="w-5 h-5 text-primary" />
                    Portfolio Growth
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64 flex items-center justify-center text-muted-foreground border border-dashed border-border rounded-lg">
                    <div className="text-center">
                      <LineChart className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Portfolio growth chart</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="w-5 h-5 text-accent" />
                    Asset Allocation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64 flex items-center justify-center text-muted-foreground border border-dashed border-border rounded-lg">
                    <div className="text-center">
                      <PieChart className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Asset allocation chart</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-primary" />
                    Monthly Returns
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64 flex items-center justify-center text-muted-foreground border border-dashed border-border rounded-lg">
                    <div className="text-center">
                      <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Monthly returns bar chart</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-accent" />
                    Risk Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64 flex items-center justify-center text-muted-foreground border border-dashed border-border rounded-lg">
                    <div className="text-center">
                      <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Risk metrics visualization</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Performance Table */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle>Strategy Performance Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-muted/30">
                      <tr className="text-xs text-muted-foreground">
                        <th className="text-left p-3 font-medium">Strategy</th>
                        <th className="text-right p-3 font-medium">Total Return</th>
                        <th className="text-right p-3 font-medium">Win Rate</th>
                        <th className="text-right p-3 font-medium">Trades</th>
                        <th className="text-right p-3 font-medium">Sharpe Ratio</th>
                        <th className="text-right p-3 font-medium">Max DD</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-border hover:bg-muted/20">
                        <td className="p-3 font-semibold">Mean Reversion Pro</td>
                        <td className="p-3 text-right font-mono text-success">+18.5%</td>
                        <td className="p-3 text-right font-mono">68%</td>
                        <td className="p-3 text-right font-mono">142</td>
                        <td className="p-3 text-right font-mono">1.92</td>
                        <td className="p-3 text-right font-mono text-destructive">-5.2%</td>
                      </tr>
                      <tr className="border-b border-border hover:bg-muted/20">
                        <td className="p-3 font-semibold">Momentum Breakout</td>
                        <td className="p-3 text-right font-mono text-success">+24.3%</td>
                        <td className="p-3 text-right font-mono">71%</td>
                        <td className="p-3 text-right font-mono">89</td>
                        <td className="p-3 text-right font-mono">2.15</td>
                        <td className="p-3 text-right font-mono text-destructive">-6.8%</td>
                      </tr>
                      <tr className="hover:bg-muted/20">
                        <td className="p-3 font-semibold">AI Smart Grid</td>
                        <td className="p-3 text-right font-mono text-success">+12.1%</td>
                        <td className="p-3 text-right font-mono">65%</td>
                        <td className="p-3 text-right font-mono">67</td>
                        <td className="p-3 text-right font-mono">1.67</td>
                        <td className="p-3 text-right font-mono text-destructive">-3.9%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default Analytics;
