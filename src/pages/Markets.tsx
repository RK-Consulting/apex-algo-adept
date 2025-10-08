import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Search, Star, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useMarketData } from "@/hooks/useMarketData";

const stockSymbols = [
  { symbol: "RELIANCE", exchange: "NSE", name: "Reliance Industries", marketCap: "16.6L Cr" },
  { symbol: "TCS", exchange: "NSE", name: "Tata Consultancy Services", marketCap: "13.8L Cr" },
  { symbol: "INFY", exchange: "NSE", name: "Infosys Limited", marketCap: "6.5L Cr" },
  { symbol: "HDFCBANK", exchange: "NSE", name: "HDFC Bank", marketCap: "12.3L Cr" },
  { symbol: "ICICIBANK", exchange: "NSE", name: "ICICI Bank", marketCap: "6.9L Cr" },
];

const indexSymbols = [
  { symbol: "NIFTY", exchange: "NSE", name: "NIFTY 50" },
  { symbol: "SENSEX", exchange: "BSE", name: "SENSEX" },
  { symbol: "BANKNIFTY", exchange: "NSE", name: "NIFTY BANK" },
  { symbol: "INDIAVIX", exchange: "NSE", name: "INDIA VIX" },
];

const sectors = [
  { name: "IT", change: "+1.45%", trend: "up", stocks: 145 },
  { name: "Banking", change: "+0.78%", trend: "up", stocks: 89 },
  { name: "Pharma", change: "-0.34%", trend: "down", stocks: 67 },
  { name: "Auto", change: "+2.12%", trend: "up", stocks: 56 },
  { name: "Energy", change: "+1.89%", trend: "up", stocks: 43 },
  { name: "FMCG", change: "-0.56%", trend: "down", stocks: 78 },
];

const Markets = () => {
  const { data: indexData, loading: indexLoading } = useMarketData(indexSymbols);
  const { data: stockData, loading: stockLoading } = useMarketData(stockSymbols);

  const formatVolume = (volume: number) => {
    if (volume >= 1000000) return `${(volume / 1000000).toFixed(1)}M`;
    if (volume >= 1000) return `${(volume / 1000).toFixed(1)}K`;
    return volume.toString();
  };

  const formatPrice = (price: number) => {
    return price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
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
              {indexSymbols.map((index) => {
                const liveData = indexData.find(d => d.symbol === index.symbol);
                const trend = liveData && liveData.change >= 0 ? "up" : "down";
                
                return (
                  <Card key={index.symbol} className="bg-card border-border hover:border-primary/50 transition-all">
                    <CardContent className="pt-6">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-sm">{index.name}</h3>
                          <div className={`w-2 h-2 rounded-full ${trend === "up" ? "bg-success" : "bg-destructive"} animate-pulse`} />
                        </div>
                        <div className="text-2xl font-mono font-bold">
                          {indexLoading ? "..." : liveData ? formatPrice(liveData.price) : "N/A"}
                        </div>
                        <div className={`flex items-center gap-1 text-sm font-medium ${trend === "up" ? "text-success" : "text-destructive"}`}>
                          {trend === "up" ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                          <span>{liveData ? `${liveData.change >= 0 ? '+' : ''}${liveData.change.toFixed(2)}` : "N/A"}</span>
                          <span className="text-xs">({liveData ? `${liveData.change_percent >= 0 ? '+' : ''}${liveData.change_percent.toFixed(2)}%` : "N/A"})</span>
                        </div>
                        <div className="pt-2 border-t border-border text-xs text-muted-foreground space-y-1">
                          <div className="flex justify-between">
                            <span>High:</span>
                            <span className="font-mono">{liveData ? formatPrice(liveData.high) : "N/A"}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Low:</span>
                            <span className="font-mono">{liveData ? formatPrice(liveData.low) : "N/A"}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
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
                          {stockLoading ? (
                            <tr>
                              <td colSpan={7} className="p-3 text-center text-muted-foreground">
                                Loading stock data...
                              </td>
                            </tr>
                          ) : stockData.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="p-3 text-center text-muted-foreground">
                                No stock data available
                              </td>
                            </tr>
                          ) : (
                            stockSymbols.map((stock, index) => {
                              const liveData = stockData.find(d => d.symbol === stock.symbol);
                              const trend = liveData && liveData.change >= 0 ? "up" : "down";
                              
                              return (
                                <tr
                                  key={stock.symbol}
                                  className={`hover:bg-muted/20 transition-colors ${
                                    index !== stockSymbols.length - 1 ? "border-b border-border" : ""
                                  }`}
                                >
                                  <td className="p-3">
                                    <div className="font-mono font-semibold text-sm">{stock.symbol}</div>
                                  </td>
                                  <td className="p-3">
                                    <div className="text-sm text-muted-foreground">{stock.name}</div>
                                  </td>
                                  <td className="p-3 text-right font-mono font-semibold">
                                    ₹{liveData ? formatPrice(liveData.price) : "N/A"}
                                  </td>
                                  <td className="p-3 text-right">
                                    <div className={`flex items-center justify-end gap-1 text-sm font-medium ${trend === "up" ? "text-success" : "text-destructive"}`}>
                                      {trend === "up" ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                      <span>{liveData ? `${liveData.change >= 0 ? '+' : ''}${liveData.change.toFixed(2)}` : "N/A"}</span>
                                      <span className="text-xs">({liveData ? `${liveData.change_percent >= 0 ? '+' : ''}${liveData.change_percent.toFixed(2)}%` : "N/A"})</span>
                                    </div>
                                  </td>
                                  <td className="p-3 text-right font-mono text-sm text-muted-foreground">
                                    {liveData ? formatVolume(liveData.volume) : "N/A"}
                                  </td>
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
                              );
                            })
                          )}
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
