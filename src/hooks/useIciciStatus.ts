import { useEffect, useState } from "react";
import { ICICI } from "@/lib/api";

export function useIciciStatus() {
  const [status, setStatus] = useState({
    loading: true,
    connected: false,
    hasCredentials: false,
    lastUpdated: null,
  });

  async function refresh() {
    try {
      const r = await ICICI.status();
      setStatus({
        loading: false,
        connected: r.data.connected,
        hasCredentials: r.data.has_credentials,
        lastUpdated: r.data.last_updated,
      });
    } catch {
      setStatus((s) => ({ ...s, loading: false }));
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  return { ...status, refresh };
}
