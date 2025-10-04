import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Search, Star, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const stocks = [
  { symbol: "RELIANCE", name: "Reliance Industries", price: "2,456.70", change: "+23.45", percent: "+0.96%", trend: "up", volume: "8.2M", marketCap: "16.6L Cr" },
  { symbol: "TCS", name: "Tata Consultancy Services", price: "3,789.20", change: "-12.30", percent: "-0.32%", trend: "down", volume: "2.1M", marketCap: "13.8L Cr" },
  { symbol: "INFY", name: "Infosys Limited", price: "1,567.45", change: "+45.60", percent: "+2.99%", trend: "up", volume: "6.5M", marketCap: "6.5L Cr" },
  { symbol: "HDFCBANK", name: "HDFC Bank", price: "1,678.90", change: "+8.75", percent: "+0.52%", trend: "up", volume: "5.3M", marketCap: "12.3L Cr" },
  { symbol: "ICICIBANK", name: "ICICI Bank", price: "987.35", change: "-5.20", percent: "-0.52%", trend: "down", volume: "7.8M", marketCap: "6.9L Cr" },
  { symbol: "BHARTIARTL", name: "Bharti Airtel", price: "1,234.56", change: "+34.20", percent: "+2.85%", trend: "up", volume: "4.2M", marketCap: "7.2L Cr" },
  { symbol: "ITC", name: "ITC Limited", price: "456.78", change: "-3.45", percent: "-0.75%", trend: "down", volume: "9.1M", marketCap: "5.7L Cr" },
  { symbol: "SBIN", name: "State Bank of India", price: "623.45", change: "+12.30", percent: "+2.01%", trend: "up", volume: "12.4M", marketCap: "5.6L Cr" },
];

const sectors = [
  { name: "IT", change: "+1.45%", trend: "up", stocks: 145 },
  { name: "Banking", change: "+0.78%", trend: "up", stocks: 89 },
  { name: "Pharma", change: "-0.34%", trend: "down", stocks: 67 },
  { name: "Auto", change: "+2.12%", trend: "up", stocks: 56 },
  { name: "Energy", change: "+1.89%", trend: "up", stocks: 43 },
  { name: "FMCG", change: "-0.56%", trend: "down", stocks: 78 },
];

const indices = [
  { name: "NIFTY 50", value: "21,453.25", change: "+245.80", percent: "+1.16%", trend: "up", high: "21,567.30", low: "21,289.45" },
  { name: "SENSEX", value: "71,283.45", change: "+823.45", percent: "+1.17%", trend: "up", high: "71,456.78", low: "70,892.34" },
  { name: "NIFTY BANK", value: "46,789.30", change: "-127.65", percent: "-0.27%", trend: "down", high: "47,123.45", low: "46,567.89" },
  { name: "NIFTY IT", value: "32,456.78", change: "+456.23", percent: "+1.43%", trend: "up", high: "32,567.90", low: "31,987.65" },
];

const Markets = () => {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <div className="container mx-auto p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  Market Watch
                </h1>
                <p className="text-muted-foreground text-sm">Real-time market data and indices</p>
              </div>
              <div className="flex gap-3">
                <div className="relative w-80">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Search stocks, indices..." className="pl-10 bg-card border-border" />
                </div>
              </div>
            </div>

            {/* Indices Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {indices.map((index) => (
                <Card key={index.name} className="bg-card border-border hover:border-primary/50 transition-all">
                  <CardContent className="pt-6">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-sm">{index.name}</h3>
                        <div className={`w-2 h-2 rounded-full ${index.trend === "up" ? "bg-success" : "bg-destructive"} animate-pulse`} />
                      </div>
                      <div className="text-2xl font-mono font-bold">{index.value}</div>
                      <div className={`flex items-center gap-1 text-sm font-medium ${index.trend === "up" ? "text-success" : "text-destructive"}`}>
                        {index.trend === "up" ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                        <span>{index.change}</span>
                        <span className="text-xs">({index.percent})</span>
                      </div>
                      <div className="pt-2 border-t border-border text-xs text-muted-foreground space-y-1">
                        <div className="flex justify-between">
                          <span>High:</span>
                          <span className="font-mono">{index.high}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Low:</span>
                          <span className="font-mono">{index.low}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Main Content Tabs */}
            <Tabs defaultValue="stocks" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="stocks">Stocks</TabsTrigger>
                <TabsTrigger value="sectors">Sectors</TabsTrigger>
                <TabsTrigger value="derivatives">Derivatives</TabsTrigger>
              </TabsList>

              <TabsContent value="stocks" className="space-y-4">
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>Top Stocks</span>
                      <Badge variant="outline">NSE</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-lg border border-border overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-muted/30">
                          <tr className="text-xs text-muted-foreground">
                            <th className="text-left p-3 font-medium">Symbol</th>
                            <th className="text-left p-3 font-medium">Company</th>
                            <th className="text-right p-3 font-medium">Price</th>
                            <th className="text-right p-3 font-medium">Change</th>
                            <th className="text-right p-3 font-medium">Volume</th>
                            <th className="text-right p-3 font-medium">Mkt Cap</th>
                            <th className="text-right p-3 font-medium">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stocks.map((stock, index) => (
                            <tr
                              key={stock.symbol}
                              className={`hover:bg-muted/20 transition-colors ${
                                index !== stocks.length - 1 ? "border-b border-border" : ""
                              }`}
                            >
                              <td className="p-3">
                                <div className="font-mono font-semibold text-sm">{stock.symbol}</div>
                              </td>
                              <td className="p-3">
                                <div className="text-sm text-muted-foreground">{stock.name}</div>
                              </td>
                              <td className="p-3 text-right font-mono font-semibold">₹{stock.price}</td>
                              <td className="p-3 text-right">
                                <div className={`flex items-center justify-end gap-1 text-sm font-medium ${stock.trend === "up" ? "text-success" : "text-destructive"}`}>
                                  {stock.trend === "up" ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                  <span>{stock.change}</span>
                                  <span className="text-xs">({stock.percent})</span>
                                </div>
                              </td>
                              <td className="p-3 text-right font-mono text-sm text-muted-foreground">{stock.volume}</td>
                              <td className="p-3 text-right font-mono text-sm text-muted-foreground">{stock.marketCap}</td>
                              <td className="p-3 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                                    <Star className="w-3 h-3" />
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                                    <Plus className="w-3 h-3" />
                                  </Button>
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

              <TabsContent value="sectors" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sectors.map((sector) => (
                    <Card key={sector.name} className="bg-card border-border hover:border-primary/50 transition-all cursor-pointer">
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-semibold text-lg">{sector.name}</h3>
                          <div className={`flex items-center gap-1 text-sm font-medium ${sector.trend === "up" ? "text-success" : "text-destructive"}`}>
                            {sector.trend === "up" ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                            <span>{sector.change}</span>
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {sector.stocks} stocks
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="derivatives" className="space-y-4">
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle>Options & Futures</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-12 text-muted-foreground">
                      <p>Derivatives data will be displayed here</p>
                      <p className="text-sm mt-2">Options chains, futures contracts, and more</p>
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

export default Markets;
