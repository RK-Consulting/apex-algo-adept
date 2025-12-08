// src/pages/Markets.tsx
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

type Tick = {
  stockCode?: string; // sometimes Breeze uses different names
  symbol?: string;
  ltp?: number;
  last?: number;
  high?: number;
  low?: number;
  change?: number;
  percentChange?: number;
  volume?: number;
  [k: string]: any;
};

export default function Markets() {
  const [indexMap, setIndexMap] = useState<Record<string, Tick>>({});
  const [stockMap, setStockMap] = useState<Record<string, Tick>>({});
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<number | null>(null);
  const reconnectAttempts = useRef(0);

  const token = localStorage.getItem("authToken") || localStorage.getItem("token");
  const iciciConnected = localStorage.getItem("icici_connected") === "true";

  // Helper to format numbers
  const formatPrice = (p?: number) =>
    p == null ? "..." : p.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const formatVolume = (v?: number) =>
    typeof v !== "number" ? "N/A" : v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(1)}K` : String(v);

  // Control API subscribe/unsubscribe helpers
  async function controlSubscribe(symbol: string, exchange = "NSE") {
    if (!token) return;
    try {
      await fetch(`${backendUrl}/api/icici/stream/subscribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ symbol, exchange }),
      });
    } catch (e) {
      console.warn("subscribe control error", e);
    }
  }

  async function controlUnsubscribe(symbol: string, exchange = "NSE") {
    if (!token) return;
    try {
      await fetch(`${backendUrl}/api/icici/stream/unsubscribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ symbol, exchange }),
      });
    } catch (e) {
      console.warn("unsubscribe control error", e);
    }
  }

  // Establish WS connection and subscribe
  useEffect(() => {
    if (!token) return;
    if (!iciciConnected) {
      console.warn("ICICI not connected → skipping realtime WS init");
      return;
    }

    const wsScheme = backendUrl.startsWith("https") ? "wss" : "ws";
    const host = new URL(backendUrl).host;
    const wsUrl = `${wsScheme}://${host}/ws/icici?token=${encodeURIComponent(token)}`;

    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
    } catch (err) {
      console.error("Failed to create WebSocket:", err);
      return;
    }

    wsRef.current = ws;

    ws.onopen = () => {
      console.log("ICICI WS connected:", wsUrl);
      reconnectAttempts.current = 0;

      // Subscribe indices first
      indexSymbols.forEach((i) => controlSubscribe(i.symbol, i.exchange));

      // Subscribe stocks
      stockSymbols.forEach((s) => controlSubscribe(s.symbol, s.exchange));
    };

    ws.onmessage = (evt) => {
      try {
        const payload = JSON.parse(evt.data) as Tick;

        // If backend sends an error-like tick for session expiry
        if ((payload as any)?.error === "ICICI_SESSION_EXPIRED") {
          console.warn("ICICI session expired (via WS)");
          window.dispatchEvent(new CustomEvent("ICICI_SESSION_EXPIRED"));
          return;
        }

        // Determine symbol key (breeze commonly uses stockCode)
        const symbol = (payload.stockCode || payload.symbol || "").toString().toUpperCase();
        if (!symbol) return;

        // Normalize fields
        const tick: Tick = {
          stockCode: symbol,
          ltp: payload.ltp ?? payload.last ?? payload.price ?? payload.lastPrice,
          high: payload.high,
          low: payload.low,
          change: payload.change,
          percentChange: payload.percentChange ?? payload.percent_change ?? payload.change_percent,
          volume: payload.volume,
          ...payload,
        };

        // If symbol matches an index, update indexMap
        if (indexSymbols.some((i) => i.symbol === symbol)) {
          setIndexMap((prev) => ({ ...prev, [symbol]: tick }));
          return;
        }

        // Otherwise update stock map
        if (stockSymbols.some((s) => s.symbol === symbol)) {
          setStockMap((prev) => ({ ...prev, [symbol]: tick }));
        }
      } catch (e) {
        console.error("WS message parse error", e);
      }
    };

    ws.onerror = (e) => {
      console.error("ICICI WS error", e);
    };

    ws.onclose = (ev) => {
      console.warn("ICICI WS closed", ev);
      // attempt reconnect with backoff
      reconnectAttempts.current = Math.min(10, reconnectAttempts.current + 1);
      const delay = Math.min(30_000, 1000 * Math.pow(1.8, reconnectAttempts.current));
      reconnectTimer.current = window.setTimeout(() => {
        // re-run effect by setting ref to null then creating new WS
        if (wsRef.current) wsRef.current = null;
        // trigger effect by calling connect again (we accomplish by creating new WebSocket below)
        // but since useEffect won't re-run automatically, we perform manual reconnect:
        try {
          const newWs = new WebSocket(wsUrl);
          wsRef.current = newWs;
          // attach same handlers (simple approach: reload page after delay as fallback)
          newWs.onopen = () => {
            console.log("ICICI WS reconnected (auto)");
            reconnectAttempts.current = 0;
          };
          newWs.onmessage = ws.onmessage;
          newWs.onclose = ws.onclose;
          newWs.onerror = ws.onerror;
        } catch (err) {
          console.error("Reconnect failed, reloading in 3s", err);
          setTimeout(() => window.location.reload(), 3000);
        }
      }, delay);
    };

    // Cleanup: unsubscribe + close websocket
    return () => {
      // clear reconnect timer
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }

      // request unsubscribe for everything we subscribed
      indexSymbols.forEach((i) => controlUnsubscribe(i.symbol, i.exchange));
      stockSymbols.forEach((s) => controlUnsubscribe(s.symbol, s.exchange));

      try {
        ws.close();
      } catch {}
      wsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, iciciConnected]);

  // Merge maps to arrays for rendering in original order
  const indexData = indexSymbols.map((i) => {
    const d = indexMap[i.symbol] || {};
    return {
      symbol: i.symbol,
      name: i.name,
      price: d.ltp ?? d.last ?? null,
      high: d.high ?? null,
      low: d.low ?? null,
      change: d.change ?? 0,
      change_percent: d.percentChange ?? 0,
    };
  });

  const stockData = stockSymbols.map((s) => {
    const d = stockMap[s.symbol] || {};
    return {
      symbol: s.symbol,
      name: s.name,
      price: d.ltp ?? d.last ?? null,
      high: d.high ?? null,
      low: d.low ?? null,
      change: d.change ?? 0,
      change_percent: d.percentChange ?? 0,
      volume: d.volume ?? 0,
      marketCap: s.marketCap,
    };
  });

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
              {indexData.map((d) => {
                const trend = (d.change || 0) >= 0 ? "up" : "down";
                return (
                  <Card key={d.symbol}>
                    <CardContent className="pt-6">
                      <div>
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-sm">{d.name}</h3>
                          <div className={`w-2 h-2 rounded-full ${trend === "up" ? "bg-success" : "bg-destructive"} animate-pulse`} />
                        </div>
                        <div className="text-2xl font-mono font-bold">{formatPrice(d.price as number)}</div>
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
                        {stockData.map((d) => {
                          const trend = (d.change || 0) >= 0 ? "up" : "down";
                          return (
                            <tr key={d.symbol} className="border-b border-border hover:bg-muted/20">
                              <td className="p-3 font-mono font-semibold">{d.symbol}</td>
                              <td className="p-3 text-muted-foreground">{d.name}</td>
                              <td className="p-3 text-right font-mono font-semibold">₹{formatPrice(d.price as number)}</td>
                              <td className="p-3 text-right">
                                <div className={`flex justify-end items-center gap-1 text-sm font-medium ${trend === "up" ? "text-success" : "text-destructive"}`}>
                                  {trend === "up" ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                  <span>{(d.change || 0).toFixed(2)}</span>
                                </div>
                              </td>
                              <td className="p-3 text-right font-mono text-sm">{formatVolume(d.volume)}</td>
                              <td className="p-3 text-right text-muted-foreground">{d.marketCap}</td>
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
