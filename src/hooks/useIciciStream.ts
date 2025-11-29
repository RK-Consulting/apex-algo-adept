// /src/hooks/useIciciStream.ts
import { useEffect, useRef, useState } from "react";
import { getToken } from "@/lib/utils";

export function useIciciStream(symbols = []) {
  const wsRef = useRef<WebSocket | null>(null);
  const [ticks, setTicks] = useState([]);

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
