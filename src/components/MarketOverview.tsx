// src/components/MarketOverview.tsx
import { useEffect, useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";

const indexSymbols = [
  { symbol: "NIFTY", exchange: "NSE", name: "NIFTY 50" },
  { symbol: "SENSEX", exchange: "BSE", name: "SENSEX" },
  { symbol: "BANKNIFTY", exchange: "NSE", name: "NIFTY BANK" },
  { symbol: "INDIAVIX", exchange: "NSE", name: "INDIA VIX" },
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
};

export function MarketOverview() {
  const [indexMap, setIndexMap] = useState<Record<string, Tick>>({});
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<number | null>(null);
  const reconnectAttempts = useRef(0);

  const token =
    localStorage.getItem("authToken") || localStorage.getItem("token");
  const iciciConnected = localStorage.getItem("icici_connected") === "true";

  const formatPrice = (p?: number) =>
    p == null
      ? "..."
      : p.toLocaleString("en-IN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });

  useEffect(() => {
    if (!token || !iciciConnected) {
      console.warn("ICICI not connected → skipping WS MarketOverview");
      return;
    }

    const wsScheme = backendUrl.startsWith("https") ? "wss" : "ws";
    const host = new URL(backendUrl).host;
    const wsUrl = `${wsScheme}://${host}/ws/icici?token=${encodeURIComponent(
      token
    )}`;

    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
    } catch (err) {
      console.error("WS creation failed", err);
      return;
    }

    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[MarketOverview] WS connected");
      reconnectAttempts.current = 0;

      // Subscribe only to indices
      indexSymbols.forEach(async (i) => {
        await fetch(`${backendUrl}/api/icici/stream/subscribe`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            symbol: i.symbol,
            exchange: i.exchange,
          }),
        });
      });
    };

    ws.onmessage = (evt) => {
      try {
        const payload = JSON.parse(evt.data) as Tick;
        const symbol =
          payload.stockCode?.toUpperCase() ||
          payload.symbol?.toUpperCase() ||
          "";

        if (!symbol) return;
        if (!indexSymbols.some((s) => s.symbol === symbol)) return;

        // Normalize tick
        const tick: Tick = {
          symbol,
          ltp: payload.ltp ?? payload.last ?? null,
          high: payload.high ?? null,
          low: payload.low ?? null,
          change: payload.change ?? 0,
          percentChange:
            payload.percentChange ??
            (payload.change_percent as number) ??
            0,
        };

        setIndexMap((prev) => ({ ...prev, [symbol]: tick }));
      } catch (e) {
        console.error("Tick parse error", e);
      }
    };

    ws.onclose = () => {
      console.warn("[MarketOverview] WS closed");
      reconnectAttempts.current++;
      const delay = Math.min(
        20000,
        1500 * reconnectAttempts.current ** 1.5
      );

      reconnectTimer.current = window.setTimeout(() => {
        console.log("[MarketOverview] reconnecting…");
        reconnectAttempts.current--;
        try {
          wsRef.current = new WebSocket(wsUrl);
        } catch {
          setTimeout(() => window.location.reload(), 2000);
        }
      }, delay);
    };

    ws.onerror = (err) => console.error("[MarketOverview] WS error", err);

    return () => {
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }

      // Unsubscribe on unmount
      indexSymbols.forEach(async (i) => {
        await fetch(`${backendUrl}/api/icici/stream/unsubscribe`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ symbol: i.symbol, exchange: i.exchange }),
        });
      });

      try {
        ws?.close();
      } catch {}
    };
  }, [token, iciciConnected]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {indexSymbols.map((i) => {
        const d = indexMap[i.symbol] || {};
        const trend = (d.change || 0) >= 0 ? "up" : "down";

        return (
          <Card
            key={i.symbol}
            className="p-4 bg-card border-border hover:border-primary/50 transition-all duration-300 cursor-pointer"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs text-muted-foreground mb-1">
                  {i.name}
                </div>

                <div className="text-2xl font-mono font-bold mb-1">
                  {formatPrice(d.ltp)}
                </div>

                <div
                  className={`flex items-center gap-1 text-sm font-medium ${
                    trend === "up" ? "text-success" : "text-destructive"
                  }`}
                >
                  {trend === "up" ? (
                    <TrendingUp className="w-4 h-4" />
                  ) : (
                    <TrendingDown className="w-4 h-4" />
                  )}
                  <span>{(d.change || 0).toFixed(2)}</span>
                  <span className="text-xs">
                    ({(d.percentChange || 0).toFixed(2)}%)
                  </span>
                </div>
              </div>

              <div
                className={`w-2 h-2 rounded-full ${
                  trend === "up" ? "bg-success" : "bg-destructive"
                } animate-pulse`}
              />
            </div>
          </Card>
        );
      })}
    </div>
  );
}
