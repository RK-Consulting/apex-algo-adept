import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, TrendingDown, Activity, DollarSign, PieChart, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { usePortfolioData } from "@/hooks/usePortfolioData";

const Portfolio = () => {
  const { holdings, totalValue, totalPnL, totalInvested, loading, error } = usePortfolioData();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <div className="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  Portfolio
                </h1>
                <p className="text-muted-foreground text-sm">Track your investments and performance</p>
              </div>
            </div>

            {/* Portfolio Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <Card className="bg-card border-border">
                <CardContent className="pt-4 sm:pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                    </div>
                  </div>
                  <div className="text-xs sm:text-sm text-muted-foreground mb-1">Total Value</div>
                  <div className="text-lg sm:text-2xl font-mono font-bold">₹{totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardContent className="pt-4 sm:pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-success/10 flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-success" />
                    </div>
                  </div>
                  <div className="text-xs sm:text-sm text-muted-foreground mb-1">Total P&L</div>
                  <div className={`text-lg sm:text-2xl font-mono font-bold ${totalPnL >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {totalPnL >= 0 ? '+' : ''}₹{totalPnL.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardContent className="pt-4 sm:pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                      <PieChart className="w-4 h-4 sm:w-5 sm:h-5 text-accent" />
                    </div>
                  </div>
                  <div className="text-xs sm:text-sm text-muted-foreground mb-1">Invested</div>
                  <div className="text-lg sm:text-2xl font-mono font-bold">₹{totalInvested.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardContent className="pt-4 sm:pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                    </div>
                  </div>
                  <div className="text-xs sm:text-sm text-muted-foreground mb-1">Holdings</div>
                  <div className="text-lg sm:text-2xl font-mono font-bold">{holdings.length}</div>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="holdings" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="holdings">Holdings</TabsTrigger>
                <TabsTrigger value="transactions">Transactions</TabsTrigger>
              </TabsList>

              <TabsContent value="holdings" className="space-y-4">
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="text-base sm:text-lg">Current Holdings</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="text-center py-8 text-muted-foreground">Loading holdings...</div>
                    ) : error ? (
                      <div className="text-center py-8 text-destructive">{error}</div>
                    ) : holdings.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No holdings found. Connect to your ICICI broker to view your portfolio.
                      </div>
                    ) : (
                      <div className="rounded-lg border border-border overflow-x-auto">
                        <table className="w-full min-w-[640px]">
                          <thead className="bg-muted/30">
                            <tr className="text-xs text-muted-foreground">
                              <th className="text-left p-2 sm:p-3 font-medium">Symbol</th>
                              <th className="text-right p-2 sm:p-3 font-medium">Qty</th>
                              <th className="text-right p-2 sm:p-3 font-medium">Avg</th>
                              <th className="text-right p-2 sm:p-3 font-medium">LTP</th>
                              <th className="text-right p-2 sm:p-3 font-medium">Invested</th>
                              <th className="text-right p-2 sm:p-3 font-medium">Current</th>
                              <th className="text-right p-2 sm:p-3 font-medium">P&L</th>
                            </tr>
                          </thead>
                          <tbody>
                            {holdings.map((holding, index) => {
                              const pnl = holding.current_value - holding.invested_value;
                              const pnlPercent = (pnl / holding.invested_value) * 100;
                              const trend = pnl >= 0 ? "up" : "down";
                              
                              return (
                                <tr
                                  key={holding.symbol}
                                  className={`hover:bg-muted/20 transition-colors ${
                                    index !== holdings.length - 1 ? "border-b border-border" : ""
                                  }`}
                                >
                                  <td className="p-2 sm:p-3">
                                    <div className="font-mono font-semibold text-xs sm:text-sm">{holding.symbol}</div>
                                  </td>
                                  <td className="p-2 sm:p-3 text-right font-mono text-xs sm:text-sm">{holding.quantity}</td>
                                  <td className="p-2 sm:p-3 text-right font-mono text-xs sm:text-sm text-muted-foreground">
                                    ₹{holding.average_price.toFixed(2)}
                                  </td>
                                  <td className="p-2 sm:p-3 text-right font-mono text-xs sm:text-sm font-semibold">
                                    ₹{holding.ltp.toFixed(2)}
                                  </td>
                                  <td className="p-2 sm:p-3 text-right font-mono text-xs sm:text-sm text-muted-foreground">
                                    ₹{holding.invested_value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                  </td>
                                  <td className="p-2 sm:p-3 text-right font-mono text-xs sm:text-sm font-semibold">
                                    ₹{holding.current_value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                  </td>
                                  <td className="p-2 sm:p-3 text-right">
                                    <div className={`font-mono text-xs sm:text-sm font-semibold ${trend === "up" ? "text-success" : "text-destructive"}`}>
                                      {pnl >= 0 ? '+' : ''}₹{pnl.toFixed(0)}
                                    </div>
                                    <div className={`flex items-center justify-end gap-1 text-[10px] sm:text-xs font-medium ${trend === "up" ? "text-success" : "text-destructive"}`}>
                                      {trend === "up" ? <TrendingUp className="w-2 h-2 sm:w-3 sm:h-3" /> : <TrendingDown className="w-2 h-2 sm:w-3 sm:h-3" />}
                                      <span>{pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%</span>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="transactions" className="space-y-4">
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="text-base sm:text-lg">Transaction History</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8 text-muted-foreground">
                      Transaction history will be available soon
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default Portfolio;
