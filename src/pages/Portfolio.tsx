import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, TrendingDown, Activity, DollarSign, PieChart, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const holdings = [
  { symbol: "RELIANCE", qty: 50, avgPrice: "2,380.00", ltp: "2,456.70", invested: "1,19,000", current: "1,22,835", pnl: "+3,835", percent: "+3.22%", trend: "up" },
  { symbol: "TCS", qty: 25, avgPrice: "3,850.00", ltp: "3,789.20", invested: "96,250", current: "94,730", pnl: "-1,520", percent: "-1.58%", trend: "down" },
  { symbol: "INFY", qty: 75, avgPrice: "1,498.00", ltp: "1,567.45", invested: "1,12,350", current: "1,17,559", pnl: "+5,209", percent: "+4.64%", trend: "up" },
  { symbol: "HDFCBANK", qty: 40, avgPrice: "1,645.00", ltp: "1,678.90", invested: "65,800", current: "67,156", pnl: "+1,356", percent: "+2.06%", trend: "up" },
  { symbol: "ICICIBANK", qty: 60, avgPrice: "995.00", ltp: "987.35", invested: "59,700", current: "59,241", pnl: "-459", percent: "-0.77%", trend: "down" },
];

const transactions = [
  { date: "2025-01-08", type: "BUY", symbol: "RELIANCE", qty: 25, price: "2,456.70", total: "61,417.50", status: "completed" },
  { date: "2025-01-08", type: "SELL", symbol: "TCS", qty: 10, price: "3,789.20", total: "37,892.00", status: "completed" },
  { date: "2025-01-07", type: "BUY", symbol: "INFY", qty: 50, price: "1,567.45", total: "78,372.50", status: "completed" },
  { date: "2025-01-07", type: "BUY", symbol: "HDFCBANK", qty: 20, price: "1,678.90", total: "33,578.00", status: "completed" },
  { date: "2025-01-06", type: "SELL", symbol: "ICICIBANK", qty: 15, price: "987.35", total: "14,810.25", status: "completed" },
];

const performance = [
  { period: "Today", pnl: "+8,945", percent: "+0.72%", trend: "up" },
  { period: "This Week", pnl: "+23,456", percent: "+1.92%", trend: "up" },
  { period: "This Month", pnl: "+67,890", percent: "+5.76%", trend: "up" },
  { period: "This Year", pnl: "+1,45,678", percent: "+13.24%", trend: "up" },
];

const Portfolio = () => {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <div className="container mx-auto p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  Portfolio
                </h1>
                <p className="text-muted-foreground text-sm">Track your investments and performance</p>
              </div>
            </div>

            {/* Portfolio Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-card border-border">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-primary" />
                    </div>
                    <Badge variant="outline" className="text-success">+5.45%</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground mb-1">Total Value</div>
                  <div className="text-2xl font-mono font-bold">₹12,45,678</div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-success" />
                    </div>
                    <Badge variant="outline" className="text-success">+0.72%</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground mb-1">Today's P&L</div>
                  <div className="text-2xl font-mono font-bold text-success">+₹8,945</div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                      <PieChart className="w-5 h-5 text-accent" />
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground mb-1">Total Invested</div>
                  <div className="text-2xl font-mono font-bold">₹11,78,257</div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Activity className="w-5 h-5 text-primary" />
                    </div>
                    <Badge variant="outline">5 Holdings</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground mb-1">Total P&L</div>
                  <div className="text-2xl font-mono font-bold text-success">+₹67,421</div>
                </CardContent>
              </Card>
            </div>

            {/* Performance Metrics */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" />
                  Performance Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {performance.map((metric) => (
                    <div key={metric.period} className="p-4 rounded-lg bg-muted/30 border border-border">
                      <div className="text-sm text-muted-foreground mb-2">{metric.period}</div>
                      <div className="text-xl font-mono font-bold text-success mb-1">₹{metric.pnl}</div>
                      <div className="flex items-center gap-1 text-xs text-success">
                        <TrendingUp className="w-3 h-3" />
                        <span>{metric.percent}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Tabs defaultValue="holdings" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="holdings">Holdings</TabsTrigger>
                <TabsTrigger value="transactions">Transactions</TabsTrigger>
              </TabsList>

              <TabsContent value="holdings" className="space-y-4">
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle>Current Holdings</CardTitle>
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
                            <th className="text-right p-3 font-medium">Invested</th>
                            <th className="text-right p-3 font-medium">Current</th>
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
                              <td className="p-3 text-right font-mono text-sm text-muted-foreground">₹{holding.avgPrice}</td>
                              <td className="p-3 text-right font-mono text-sm font-semibold">₹{holding.ltp}</td>
                              <td className="p-3 text-right font-mono text-sm text-muted-foreground">₹{holding.invested}</td>
                              <td className="p-3 text-right font-mono text-sm font-semibold">₹{holding.current}</td>
                              <td className={`p-3 text-right font-mono text-sm font-semibold ${holding.trend === "up" ? "text-success" : "text-destructive"}`}>
                                ₹{holding.pnl}
                              </td>
                              <td className="p-3 text-right">
                                <div className={`flex items-center justify-end gap-1 text-xs font-medium ${holding.trend === "up" ? "text-success" : "text-destructive"}`}>
                                  {holding.trend === "up" ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
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
              </TabsContent>

              <TabsContent value="transactions" className="space-y-4">
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle>Transaction History</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-lg border border-border overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-muted/30">
                          <tr className="text-xs text-muted-foreground">
                            <th className="text-left p-3 font-medium">Date</th>
                            <th className="text-left p-3 font-medium">Type</th>
                            <th className="text-left p-3 font-medium">Symbol</th>
                            <th className="text-right p-3 font-medium">Qty</th>
                            <th className="text-right p-3 font-medium">Price</th>
                            <th className="text-right p-3 font-medium">Total</th>
                            <th className="text-right p-3 font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {transactions.map((txn, index) => (
                            <tr
                              key={index}
                              className={`hover:bg-muted/20 transition-colors ${
                                index !== transactions.length - 1 ? "border-b border-border" : ""
                              }`}
                            >
                              <td className="p-3 text-sm text-muted-foreground">{txn.date}</td>
                              <td className="p-3">
                                <Badge variant={txn.type === "BUY" ? "default" : "destructive"} className="text-xs">
                                  {txn.type}
                                </Badge>
                              </td>
                              <td className="p-3">
                                <div className="font-mono font-semibold text-sm">{txn.symbol}</div>
                              </td>
                              <td className="p-3 text-right font-mono text-sm">{txn.qty}</td>
                              <td className="p-3 text-right font-mono text-sm">₹{txn.price}</td>
                              <td className="p-3 text-right font-mono text-sm font-semibold">₹{txn.total}</td>
                              <td className="p-3 text-right">
                                <Badge variant="outline" className="text-xs">
                                  {txn.status}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
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
