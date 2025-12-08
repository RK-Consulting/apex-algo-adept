// src/hooks/useICICIRealtimeTickers.ts
import { useEffect, useState, useRef } from "react";

interface TickerData {
  symbol: string;
  price: number;
  change: number;
  change_percent: number;
}

export function useICICIRealtimeTickers(symbols: { symbol: string; exchange: string }[]) {
  const [data, setData] = useState<TickerData[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const ws = new WebSocket(
      `${import.meta.env.VITE_WS_URL || "ws://localhost:3000"}/ws/icici?token=${token}`
    );

    wsRef.current = ws;

    ws.onopen = () => {
      console.log("🔥 Connected to ICICI realtime stream");

      ws.send(
        JSON.stringify({
          action: "subscribe",
          symbols
        })
      );
    };

    ws.onmessage = (ev) => {
      try {
        const tick = JSON.parse(ev.data);

        if (!tick?.symbol) return;

        setData((prev) => {
          const existing = prev.find((t) => t.symbol === tick.symbol);
          const updated: TickerData = {
            symbol: tick.symbol,
            price: tick.last || tick.price || 0,
            change: tick.change || 0,
            change_percent: tick.change_percent || 0,
          };

          if (existing) {
            return prev.map((p) =>
              p.symbol === tick.symbol ? updated : p
            );
          } else {
            return [...prev, updated];
          }
        });
      } catch (e) {
        console.error("Tick parse error", e);
      }
    };

    ws.onerror = (err) => console.error("WS error:", err);
    ws.onclose = () => console.log("❌ ICICI realtime disconnected");

    return () => {
      ws.close();
    };
  }, []);

  return { data };
}
