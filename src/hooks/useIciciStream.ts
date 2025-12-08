// /src/hooks/useIciciStream.ts
import { useEffect, useRef, useState } from "react";
import { getToken } from "@/lib/utils";

export function useIciciStream(symbols = []) {
  const wsRef = useRef<WebSocket | null>(null);
  const [ticks, setTicks] = useState([]);
// src/hooks/useIciciStream.ts
import { useEffect, useRef, useState } from "react";
import { getToken } from "@/lib/utils";

interface Tick {
  symbol: string;
  price: number;
  change?: number;
  change_percent?: number;
  [key: string]: any;
}

export function useIciciStream(symbols: { symbol: string; exchange?: string }[] = []) {
  const wsRef = useRef<WebSocket | null>(null);
  const [ticks, setTicks] = useState<Record<string, Tick>>({});

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    const iciciConnected = localStorage.getItem("icici_connected") === "true";
    if (!iciciConnected) {
      console.warn("ICICI not connected → skipping realtime stream");
      return;
    }

    // Construct WS URL
    const wsUrl = `${
      (import.meta.env.VITE_WS_URL || "").replace("https://", "wss://")
    }/ws/icici?token=${token}`;

    console.log("🔌 Connecting ICICI WS:", wsUrl);

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("🔥 ICICI realtime connected");

      // Subscribe to requested symbols
      ws.send(
        JSON.stringify({
          action: "subscribe",
          symbols,
        })
      );
    };

    ws.onmessage = (msg) => {
      try {
        const tick = JSON.parse(msg.data);

        // Handle session expiry notice from backend
        if (tick?.error === "ICICI_SESSION_EXPIRED") {
          console.warn("❌ ICICI session expired (WS)");
          window.dispatchEvent(new CustomEvent("ICICI_SESSION_EXPIRED"));
          return;
        }

        if (!tick.symbol) return;

        // Merge tick into dictionary
        setTicks((prev) => ({
          ...prev,
          [tick.symbol]: {
            symbol: tick.symbol,
            price: tick.last || tick.price || 0,
            change: tick.change || 0,
            change_percent: tick.change_percent || 0,
            ...tick,
          },
        }));
      } catch (e) {
        console.error("Tick parse error:", e);
      }
    };

    ws.onerror = (err) => console.error("WS error:", err);
    ws.onclose = () => console.log("❌ ICICI realtime disconnected");

    return () => ws.close();
  }, []);

  return Object.values(ticks);
}

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    const iciciConnected = localStorage.getItem("icici_connected") === "true";
    const apisession = localStorage.getItem("icici_apisession");
    if (!iciciConnected || !apisession) {
      console.warn("ICICI not connected → skipping WebSocket init");
      return () => {};
    }
    const ws = new WebSocket(
      `${import.meta.env.VITE_API_URL.replace("https://", "wss://")}/api/icici/stream?token=${token}`
    );

    wsRef.current = ws;

    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data);
        setTicks((t) => [...t, data]);
      } catch {}
    };

    ws.onclose = () => console.log("WS closed");
    ws.onerror = () => console.log("WS error");

    return () => ws.close();
  }, []);

  return ticks;
}
