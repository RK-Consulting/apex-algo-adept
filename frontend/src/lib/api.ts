const API_ROOT = (import.meta.env.VITE_API_URL as string) || "/api";

/**
 * request - centralized fetch wrapper
 * - Automatically sets Authorization header from localStorage token.
 * - Throws an Error object with { status, message } for caller to handle.
 */
export async function request(
  path: string,
  opts: RequestInit = {}
): Promise<any> {
  const token =
    localStorage.getItem("token") ||
    localStorage.getItem("authToken");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_ROOT}${path}`, {
    ...opts,
    headers,
  });

  const text = await res.text().catch(() => "");
  let body: any = null;

  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  // ---------- Error handling ----------
  if (!res.ok) {
    const message =
      body?.error ||
      body?.message ||
      res.statusText ||
      "Request failed";

    const err = new Error(message) as any;
    err.status = res.status;

    // 🔔 ICICI-specific global events (defensive, backend-agnostic)
    if (
      typeof message === "string" &&
      message.toLowerCase().includes("icici session expired")
    ) {
      window.dispatchEvent(new CustomEvent("ICICI_SESSION_EXPIRED"));
    }

    if (
      typeof message === "string" &&
      message.toLowerCase().includes("icici not connected")
    ) {
      window.dispatchEvent(new CustomEvent("ICICI_SESSION_MISSING"));
    }

    throw err;
  }

  return body;
}

// -----------------------------------------------------------
// API WRAPPER
// -----------------------------------------------------------
export const api = {
  get: (path: string) => request(path),
  post: (path: string, body?: any) =>
    request(path, {
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
};

// -----------------------------------------------------------
// ICICI WRAPPER (ALIGNED WITH FINAL BACKEND)
// -----------------------------------------------------------
export const ICICI = {
  // Option 2: Redirect to backend
  connect: () => {
    const API_ROOT = (import.meta.env.VITE_API_URL as string) || "/api";
    window.location.href = `${API_ROOT}/icici/connect`;
  },

  // Read-only endpoints
  status: () => api.get("/icici/status"),
  me: () => api.get("/icici/me"),
  orders: () => api.get("/icici/orders"),
  holdings: () => api.get("/icici/portfolio/holdings"),
  positions: () => api.get("/icici/portfolio/positions"),
  funds: () => api.get("/icici/portfolio/funds"),
  summary: () => api.get("/icici/portfolio/summary"),
  
  quote: (symbol: string, exchange = "NSE") =>
    api.get(`/icici/market/quote?symbol=${symbol}&exchange=${exchange}`),
  ohlc: (payload: any) => api.post("/icici/market/ohlc", payload),
  ltp: (symbol: string, exchange = "NSE") =>
    api.get(`/icici/market/ltp?symbol=${symbol}&exchange=${exchange}`),
};
