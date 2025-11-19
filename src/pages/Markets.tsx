import { useEffect, useState, useRef } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Search, Star, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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

const backendUrl = import.meta.env.VITE_BACKEND_URL || "https://api.alphaforge.skillsifter.in";

export default function Markets() {
  const [indexData, setIndexData] = useState<any[]>([]);
  const [stockData, setStockData] = useState<any[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  const token = localStorage.getItem("authToken") || localStorage.getItem("token");

  // ----------------------------
  // 🔥 Fetch Live Quotes (REST)
  // ----------------------------
  const fetchQuote = async (symbol: string) => {
    try {
     // const res = await fetch(`${backendUrl}/api/icici/quote/${symbol}`, {
        const res = await fetch(`${backendUrl}/api/icici/market/quote?symbol=${symbolInfo.symbol}`, {
                   headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) return null;
      const json = await res.json();
      return json.quote?.Success?.[0] || null;
    } catch {
      return null;
    }
  };

  // Fetch all REST quotes every 1 sec (fallback)
  useEffect(() => {
    if (!token) return;   // ⛔ Prevents infinite 500 spam when token missing
    const fetchAll = async () => {
      const indexRes = await Promise.all(
        indexSymbols.map((i) => fetchQuote(i.symbol))
      );
      setIndexData(
        indexRes.map((q, idx) =>
          q
            ? {
                symbol: indexSymbols[idx].symbol,
                price: q.ltp,
                high: q.high,
                low: q.low,
                change: q.change,
                change_percent: q.percentChange,
              }
            : {}
        )
      );

      const stockRes = await Promise.all(
        stockSymbols.map((s) => fetchQuote(s.symbol))
      );
      setStockData(
        stockRes.map((q, idx) =>
          q
            ? {
                symbol: stockSymbols[idx].symbol,
                price: q.ltp,
                high: q.high,
                low: q.low,
                change: q.change,
                change_percent: q.percentChange,
                volume: q.volume,
              }
            : {}
        )
      );
    };

    fetchAll();
    const interval = setInterval(fetchAll, 1000);
    return () => clearInterval(interval);
  }, []);

  // ----------------------------
  // 🔥 REAL-TIME STREAMING (WS)
  // ----------------------------
  useEffect(() => {
    if (!token) return;

    const ws = new WebSocket(
      `${backendUrl.replace("https://", "wss://")}/api/icici/stream`
    );
    wsRef.current = ws;

    ws.onopen = () => console.log("WebSocket connected ✔");

    ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data);
        if (!data?.stockCode) return;

        // Update stockData live
        setStockData((prev) =>
          prev.map((item) =>
            item.symbol === data.stockCode
              ? {
                  ...item,
                  price: data.ltp,
                  high: data.high,
                  low: data.low,
                  change: data.change,
                  change_percent: data.percentChange,
                }
              : item
          )
        );
      } catch {}
    };

    ws.onclose = () => {
      console.log("WebSocket disconnected — reconnecting in 3s");
      setTimeout(() => window.location.reload(), 3000);
    };

    return () => ws.close();
  }, []);

  // ----------------------------
  // Formatters
  // ----------------------------
  const formatPrice = (p: number) =>
    p?.toLocaleString("en-IN", { minimumFractionDigits: 2 });

  const formatVolume = (v: number) =>
    v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M`
    : v >= 1000 ? `${(v / 1000).toFixed(1)}K`
    : v || "N/A";

  // ----------------------------
  // Render Below (No UI changes)
  // ----------------------------
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <div className="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">

            {/* ------------------ HEADER ------------------ */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  Market Watch
                </h1>
                <p className="text-muted-foreground text-sm">
                  Real-time market data and indices
                </p>
              </div>

              <div className="flex gap-3 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-80">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Search..." className="pl-10 bg-card border-border" />
                </div>
              </div>
            </div>

            {/* ------------------ INDICES ------------------ */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {indexSymbols.map((index, idx) => {
                const d = indexData[idx];
                const trend = d?.change >= 0 ? "up" : "down";

                return (
                  <Card key={index.symbol} className="bg-card border-border hover:border-primary/50 transition-all">
                    <CardContent className="pt-6">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-sm">{index.name}</h3>
                          <div className={`w-2 h-2 rounded-full ${trend === "up" ? "bg-success" : "bg-destructive"} animate-pulse`} />
                        </div>
                        <div className="text-2xl font-mono font-bold">
                          {formatPrice(d?.price) || "..."}
                        </div>
                        <div className={`flex items-center gap-1 text-sm font-medium ${trend === "up" ? "text-success" : "text-destructive"}`}>
                          {trend === "up" ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                          <span>{d?.change?.toFixed(2) || "0.00"}</span>
                          <span className="text-xs">
                            ({d?.change_percent?.toFixed(2) || "0.00"}%)
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* ------------------ STOCK TABLE ------------------ */}
            <Tabs defaultValue="stocks" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="stocks">Stocks</TabsTrigger>
                <TabsTrigger value="sectors">Sectors</TabsTrigger>
                <TabsTrigger value="derivatives">Derivatives</TabsTrigger>
              </TabsList>

              <TabsContent value="stocks">
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>Top Stocks</span>
                      <Badge variant="outline">NSE</Badge>
                    </CardTitle>
                  </CardHeader>

                  <CardContent>
                    <table className="w-full">
                      <thead>
                        <tr className="text-xs text-muted-foreground bg-muted/30">
                          <th className="text-left p-3">Symbol</th>
                          <th className="text-left p-3">Company</th>
                          <th className="text-right p-3">Price</th>
                          <th className="text-right p-3">Change</th>
                          <th className="text-right p-3">Volume</th>
                          <th className="text-right p-3">Mkt Cap</th>
                          <th className="text-right p-3">Action</th>
                        </tr>
                      </thead>

                      <tbody>
                        {stockSymbols.map((s, idx) => {
                          const d = stockData[idx] || {};
                          const trend = d.change >= 0 ? "up" : "down";

                          return (
                            <tr key={s.symbol} className="border-b border-border hover:bg-muted/20">
                              <td className="p-3 font-mono font-semibold">{s.symbol}</td>
                              <td className="p-3 text-muted-foreground">{s.name}</td>
                              <td className="p-3 text-right font-mono font-semibold">
                                ₹{formatPrice(d.price)}
                              </td>
                              <td className="p-3 text-right">
                                <div className={`flex justify-end items-center gap-1 text-sm font-medium ${trend === "up" ? "text-success" : "text-destructive"}`}>
                                  {trend === "up" ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                  <span>{d.change?.toFixed(2)}</span>
                                  <span className="text-xs">({d.change_percent?.toFixed(2)}%)</span>
                                </div>
                              </td>
                              <td className="p-3 text-right font-mono text-sm">
                                {formatVolume(d.volume)}
                              </td>
                              <td className="p-3 text-right text-muted-foreground">{s.marketCap}</td>
                              <td className="p-3 text-right">
                                <div className="flex justify-end gap-2">
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
                        })}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
