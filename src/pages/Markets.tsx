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

  // ✅ MODIFIED: backend-driven ICICI state
  const [iciciConnected, setIciciConnected] = useState<boolean | null>(null);

  // Helper to format numbers
  const formatPrice = (p?: number) =>
    p == null ? "..." : p.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const formatVolume = (v?: number) =>
    typeof v !== "number"
      ? "N/A"
      : v >= 1_000_000
      ? `${(v / 1_000_000).toFixed(1)}M`
      : v >= 1000
      ? `${(v / 1000).toFixed(1)}K`
      : String(v);

  // ✅ MODIFIED: fetch ICICI status from backend
  useEffect(() => {
    if (!token) return;

    fetch(`${backendUrl}/api/icici/status`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((r) => r.json())
      .then((data) => {
        setIciciConnected(data?.connected === true);
      })
      .catch((err) => {
        console.error("ICICI status fetch failed", err);
        setIciciConnected(false);
      });
  }, [token]);

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

    // ✅ MODIFIED: wait until backend status is known
    if (iciciConnected !== true) {
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

      indexSymbols.forEach((i) => controlSubscribe(i.symbol, i.exchange));
      stockSymbols.forEach((s) => controlSubscribe(s.symbol, s.exchange));
    };

    ws.onmessage = (evt) => {
      try {
        const payload = JSON.parse(evt.data) as Tick;

        if ((payload as any)?.error === "ICICI_SESSION_EXPIRED") {
          window.dispatchEvent(new CustomEvent("ICICI_SESSION_EXPIRED"));
          return;
        }

        const symbol = (payload.stockCode || payload.symbol || "").toUpperCase();
        if (!symbol) return;

        const tick: Tick = {
          stockCode: symbol,
          ltp: payload.ltp ?? payload.last,
          high: payload.high,
          low: payload.low,
          change: payload.change,
          percentChange: payload.percentChange,
          volume: payload.volume,
          ...payload,
        };

        if (indexSymbols.some((i) => i.symbol === symbol)) {
          setIndexMap((prev) => ({ ...prev, [symbol]: tick }));
          return;
        }

        if (stockSymbols.some((s) => s.symbol === symbol)) {
          setStockMap((prev) => ({ ...prev, [symbol]: tick }));
        }
      } catch (e) {
        console.error("WS message parse error", e);
      }
    };

    ws.onerror = (e) => console.error("ICICI WS error", e);

    ws.onclose = () => console.warn("ICICI WS closed");

    return () => {
      indexSymbols.forEach((i) => controlUnsubscribe(i.symbol, i.exchange));
      stockSymbols.forEach((s) => controlUnsubscribe(s.symbol, s.exchange));
      try {
        ws.close();
      } catch {}
      wsRef.current = null;
    };
  }, [token, iciciConnected]);

  // --- rendering logic unchanged below ---
  // (rest of file remains exactly as before)
