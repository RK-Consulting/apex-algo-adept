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
  stockCode?: string;
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

  const formatPrice = (p?: number) =>
    p == null
      ? "..."
      : p.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const formatVolume = (v?: number) =>
    typeof v !== "number"
      ? "N/A"
      : v >= 1_000_000
        ? `${(v / 1_000_000).toFixed(1)}M`
        : v >= 1000
          ? `${(v / 1000).toFixed(1)}K`
          : String(v);

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

  useEffect(() => {
    if (!token || !iciciConnected) return;

    const wsScheme = backendUrl.startsWith("https") ? "wss" : "ws";
    const host = new URL(backendUrl).host;
    const wsUrl = `${wsScheme}://${host}/ws/icici?token=${encodeURIComponent(token)}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectAttempts.current = 0;
      indexSymbols.forEach(i => controlSubscribe(i.symbol, i.exchange));
      stockSymbols.forEach(s => controlSubscribe(s.symbol, s.exchange));
    };

    ws.onmessage = evt => {
      const payload = JSON.parse(evt.data) as Tick;
      const symbol = (payload.stockCode || payload.symbol || "").toUpperCase();
      if (!symbol) return;

      const tick: Tick = {
        stockCode: symbol,
        ltp: payload.ltp ?? payload.last,
        percentChange: payload.percentChange ?? payload.percent_change,
        ...payload,
      };

      if (indexSymbols.some(i => i.symbol === symbol)) {
        setIndexMap(prev => ({ ...prev, [symbol]: tick }));
      } else if (stockSymbols.some(s => s.symbol === symbol)) {
        setStockMap(prev => ({ ...prev, [symbol]: tick }));
      }
    };

    ws.onclose = () => {
      reconnectAttempts.current++;
      reconnectTimer.current = window.setTimeout(
        () => window.location.reload(),
        Math.min(30_000, 1000 * Math.pow(1.8, reconnectAttempts.current))
      );
    };

    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      indexSymbols.forEach(i => controlUnsubscribe(i.symbol, i.exchange));
      stockSymbols.forEach(s => controlUnsubscribe(s.symbol, s.exchange));
      ws.close();
    };
  }, [token, iciciConnected]);

  const indexData = indexSymbols.map(i => {
    const d = indexMap[i.symbol] || {};
    return {
      symbol: i.symbol,
      name: i.name,
      price: d.ltp ?? d.last ?? null,
      change: d.change ?? 0,
      change_percent: d.percentChange ?? 0,
    };
  });

  const stockData = stockSymbols.map(s => {
    const d = stockMap[s.symbol] || {};
    return {
      symbol: s.symbol,
      name: s.name,
      price: d.ltp ?? d.last ?? null,
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
          <div className="container mx-auto p-4 space-y-6">
            <h1 className="text-3xl font-bold">Market Watch</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {indexData.map(d => (
                <Card key={d.symbol}>
                  <CardContent className="pt-6">
                    <h3 className="font-semibold">{d.name}</h3>
                    <div className="text-2xl font-mono">{formatPrice(d.price as number)}</div>
                  </CardContent>
                </Card>
              ))}
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
                    <CardTitle>
                      Top Stocks <Badge variant="outline">NSE</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <table className="w-full">
                      <tbody>
                        {stockData.map(d => (
                          <tr key={d.symbol}>
                            <td>{d.symbol}</td>
                            <td>{d.name}</td>
                            <td>₹{formatPrice(d.price as number)}</td>
                            <td>{formatVolume(d.volume)}</td>
                          </tr>
                        ))}
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
