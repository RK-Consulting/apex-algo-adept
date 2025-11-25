// /src/pages/Markets.tsx
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
  { symbol: "ICICIBANK", exchange: "NSE", name: "ICICI Bank", marketCap: "6.9L Cr" }
];

const indexSymbols = [
  { symbol: "NIFTY", exchange: "NSE", name: "NIFTY 50" },
  { symbol: "SENSEX", exchange: "BSE", name: "SENSEX" },
  { symbol: "BANKNIFTY", exchange: "NSE", name: "NIFTY BANK" },
  { symbol: "INDIAVIX", exchange: "NSE", name: "INDIA VIX" }
];

const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

export default function Markets() {
  const [indexData, setIndexData] = useState<any[]>([]);
  const [stockData, setStockData] = useState<any[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  const token = localStorage.getItem("authToken") || localStorage.getItem("token");

  const fetchQuote = async (symbol: string) => {
    try {
      const res = await fetch(`${backendUrl}/api/icici/market/quote?symbol=${symbol}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return null;
      const json = await res.json();
      // defensive access
      return json.quote?.Success?.[0] || json.quote || null;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    if (!token) return;
    const fetchAll = async () => {
      const indexRes = await Promise.all(indexSymbols.map((i) => fetchQuote(i.symbol)));
      setIndexData(indexRes.map((q, idx) => q ? { symbol: indexSymbols[idx].symbol, price: q.ltp || q.LastPrice, high: q.high, low: q.low, change: q.change, change_percent: q.percentChange } : {}));

      const stockRes = await Promise.all(stockSymbols.map((s) => fetchQuote(s.symbol)));
      setStockData(stockRes.map((q, idx) => q ? { symbol: stockSymbols[idx].symbol, price: q.ltp || q.LastPrice, high: q.high, low: q.low, change: q.change, change_percent: q.percentChange, volume: q.volume } : {}));
    };

    fetchAll();
    const iv = setInterval(fetchAll, 1000);
    return () => clearInterval(iv);
  }, [token]);

  useEffect(() => {
    if (!token) return;

    // const wsUrl = `${backendUrl.replace("http", "ws")}/api/icici/stream`;
    // const ws = new WebSocket(wsUrl, ["auth", token]);
    //const wsUrl = `${backendUrl.replace("http", "ws")}/api/icici/stream?token=${encodeURIComponent(token)}`;
    const wsScheme = backendUrl.startsWith("https") ? "wss" : "ws";
    const wsUrl = `${wsScheme}://${new URL(backendUrl).host}/api/icici/stream?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("WS Connected");
      // Subscribe via control endpoint (safer than sending many WS messages)
      stockSymbols.forEach(async (s) => {
        try {
          await fetch(`${backendUrl}/api/icici/stream/subscribe`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ symbol: s.symbol, exchange: s.exchange })
          });
        } catch {}
      });
    };

    ws.onmessage = (evt) => {
      try {
        const payload = JSON.parse(evt.data);
        if (payload?.type === "tick" && payload.data) {
          const tick = payload.data;
          setStockData((prev)=> prev.map((it)=> it.symbol === tick.stockCode ? { ...it, price: tick.ltp, high: tick.high, low: tick.low, change: tick.change, change_percent: tick.percentChange } : it));
        }
      } catch (e) { console.error(e); }
    };

    ws.onclose = () => setTimeout(()=> window.location.reload(), 3000);
    ws.onerror = (e) => console.error("WS error", e);
    return () => ws.close();
  }, [token]);

  const formatPrice = (p: number) => p?.toLocaleString("en-IN", { minimumFractionDigits: 2 });
  const formatVolume = (v: number) => v >= 1_000_000 ? `${(v/1_000_000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(1)}K` : v || "N/A";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <div className="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold">Market Watch</h1>
                <p className="text-muted-foreground text-sm">Real-time market data and indices</p>
              </div>
              <div className="relative flex-1 sm:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search..." className="pl-10 bg-card border-border" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {indexSymbols.map((idx, i)=> {
                const d = indexData[i] || {};
                const trend = (d?.change || 0) >= 0 ? "up" : "down";
                return (
                  <Card key={idx.symbol}>
                    <CardContent className="pt-6">
                      <div>
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-sm">{idx.name}</h3>
                          <div className={`w-2 h-2 rounded-full ${trend === "up" ? "bg-success" : "bg-destructive"} animate-pulse`} />
                        </div>
                        <div className="text-2xl font-mono font-bold">{formatPrice(d.price) || "..."}</div>
                        <div className={`flex items-center gap-1 text-sm font-medium ${trend === "up" ? "text-success" : "text-destructive"}`}>
                          {trend === "up" ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                          <span>{(d.change || 0).toFixed(2)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <Tabs defaultValue="stocks">
              <TabsList className="grid grid-cols-3">
                <TabsTrigger value="stocks">Stocks</TabsTrigger>
                <TabsTrigger value="sectors">Sectors</TabsTrigger>
                <TabsTrigger value="derivatives">Derivatives</TabsTrigger>
              </TabsList>

              <TabsContent value="stocks">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between"><span>Top Stocks</span><Badge variant="outline">NSE</Badge></CardTitle>
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
                        {stockSymbols.map((s, idx)=> {
                          const d = stockData[idx] || {};
                          const trend = (d.change || 0) >= 0 ? "up" : "down";
                          return (
                            <tr key={s.symbol} className="border-b border-border hover:bg-muted/20">
                              <td className="p-3 font-mono font-semibold">{s.symbol}</td>
                              <td className="p-3 text-muted-foreground">{s.name}</td>
                              <td className="p-3 text-right font-mono font-semibold">₹{formatPrice(d.price)}</td>
                              <td className="p-3 text-right">
                                <div className={`flex justify-end items-center gap-1 text-sm font-medium ${trend === "up" ? "text-success" : "text-destructive"}`}>
                                  {trend === "up" ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                  <span>{(d.change || 0).toFixed(2)}</span>
                                </div>
                              </td>
                              <td className="p-3 text-right font-mono text-sm">{formatVolume(d.volume)}</td>
                              <td className="p-3 text-right text-muted-foreground">{s.marketCap}</td>
                              <td className="p-3 text-right">
                                <div className="flex justify-end gap-2">
                                  <Button size="sm" variant="ghost"><Star className="w-3 h-3" /></Button>
                                  <Button size="sm" variant="ghost"><Plus className="w-3 h-3" /></Button>
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
