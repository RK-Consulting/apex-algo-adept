// src/lib/api.ts
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
  const token = localStorage.getItem("token");

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

  if (!res.ok) {
    const err = new Error(body?.error || body?.message || res.statusText || "Request failed");
    (err as any).status = res.status;
    (err as any).body = body;
    throw err;
  }

  return body;
}

export const api = {
  get: (path: string) => request(path),
  post: (path: string, body?: any) =>
    request(path, {
      method: "POST",
      body: JSON.stringify(body),
    }),
};


// ICICI APIs
export const ICICI = {
  status: () => api.get("/icici/status"),
  callback: (payload) => api.post("/icici/auth/callback", payload),
  connect: () => api.post("/icici/connect"),
  me: () => api.get("/icici/me"),
  orders: () => api.get("/icici/orders"),
  holdings: () => api.get("/icici/portfolio/holdings"),
  positions: () => api.get("/icici/portfolio/positions"),
  funds: () => api.get("/icici/portfolio/funds"),
  summary: () => api.get("/icici/portfolio/summary"),
  quote: (symbol, exchange = "NSE") =>
    api.get(`/icici/market/quote?symbol=${symbol}&exchange=${exchange}`),
  ohlc: (payload) => api.post("/icici/market/ohlc", payload),
  ltp: (symbol, exchange = "NSE") =>
    api.get(`/icici/market/ltp?symbol=${symbol}&exchange=${exchange}`),
};

