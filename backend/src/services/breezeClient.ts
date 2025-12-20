/**
 * ICICI Breeze REST API Gateway - Institutional-Grade Integration
 *
 * Engineering Guarantees:
 * - Explicit runtime-prefixed credential usage
 * - Zero DB naming leakage into runtime logic
 * - AI-readable data lineage (2030+ safe)
 * - Traceable request lifecycle (Request-ID)
 * - Circuit breaker + retry hardened
 */

import axios, { AxiosError } from "axios";
import { Agent } from "https";
import crypto from "crypto";

import { calculateChecksum, getTimestamp } from "../utils/breezeChecksum.js";
import { SessionService } from "./sessionService.js";
import { retryWithBackoff } from "../utils/retry.js";
import { iciciCircuitBreaker } from "../utils/circuitBreaker.js";

/* ======================================================
   CONSTANTS
====================================================== */
const ICICI_BASE_URL = "https://api.icicidirect.com/breezeapi";

/* ======================================================
   HTTPS AGENT (LOW LATENCY, KEEP-ALIVE)
====================================================== */
const httpsAgent = new Agent({
  keepAlive: true,
  maxSockets: 50,
  maxFreeSockets: 10,
  timeout: 60_000,
  keepAliveMsecs: 30_000,
});

/* ======================================================
   AXIOS INSTANCE
====================================================== */
const breezeAxios = axios.create({
  baseURL: ICICI_BASE_URL,
  httpsAgent,
  timeout: 30_000,
  maxRedirects: 5,
  headers: { "Content-Type": "application/json" },
});

/* ======================================================
   BREEZE REQUEST GATEWAY
====================================================== */
export async function breezeRequest<T = any>(
  userId: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  endpoint: string,
  payload: Record<string, any> = {}
): Promise<T> {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  if (process.env.NODE_ENV !== "production") {
    console.debug(
      `[Breeze] ${method} ${endpoint} | user=${userId} | reqId=${requestId}`
    );
  }

  try {
    /* --------------------------------------------------
       RUNTIME SESSION (EXPLICIT LAYER)
    -------------------------------------------------- */
    const runtimeSession =
      await SessionService.getInstance().getSession(userId);

    if (
      !runtimeSession ||
      !runtimeSession.api_key ||
      !runtimeSession.api_secret ||
      !runtimeSession.session_token
    ) {
      throw new Error("ICICI runtime session invalid or missing");
    }

    /* --------------------------------------------------
       RUNTIME MATERIALIZATION
    -------------------------------------------------- */
    const runtimeAppKey = runtimeSession.api_key;
    const runtimeAppSecret = runtimeSession.api_secret;
    const runtimeSessionToken = runtimeSession.session_token;

    /* --------------------------------------------------
       CUSTOMER DETAILS (SPECIAL CASE: POST)
    -------------------------------------------------- */
    if (endpoint.includes("customerdetails")) {
      const response = await iciciCircuitBreaker.execute(() =>
        retryWithBackoff(() =>
          breezeAxios.post(endpoint, {
            SessionToken: payload.SessionToken,
            AppKey: runtimeAppKey, // runtime → API mapping
          })
        )
      );

      if (response.data?.Status !== 200) {
        throw new Error(
          `CustomerDetails error: ${response.data?.Error || "Unknown"}`
        );
      }

      return response.data;
    }

    /* --------------------------------------------------
       CHECKSUM COMPUTATION (RUNTIME SECRET)
    -------------------------------------------------- */
    const timestamp = getTimestamp();
    const checksumPayload = method === "GET" ? {} : payload;

    const checksum = calculateChecksum(
      timestamp,
      checksumPayload,
      runtimeAppSecret
    );

    /* --------------------------------------------------
       REQUEST HEADERS (RUNTIME → NETWORK)
    -------------------------------------------------- */
    const headers = {
      "X-Timestamp": timestamp,
      "X-AppKey": runtimeAppKey,
      "X-SessionToken": runtimeSessionToken,
      "X-Checksum": `token ${checksum}`,
      "X-Request-ID": requestId,
    };

    /* --------------------------------------------------
       API INVOCATION
    -------------------------------------------------- */
    const response = await iciciCircuitBreaker.execute(() =>
      retryWithBackoff(() =>
        breezeAxios({
          method,
          url: endpoint,
          data: payload,
          headers,
        })
      )
    );

    if (response.data?.Status && response.data.Status !== 200) {
      throw new Error(
        `Breeze API error: ${response.data.Error || "Unknown"}`
      );
    }

    if (process.env.NODE_ENV !== "production") {
      console.debug(
        `[Breeze] ${method} ${endpoint} | OK | ${Date.now() - startTime}ms | reqId=${requestId}`
      );
    }

    return response.data;
  } catch (error: unknown) {
    const axiosError = error as AxiosError;

    if (axios.isAxiosError(axiosError)) {
      const status = axiosError.response?.status;

      if (status === 401) {
        await SessionService.getInstance().invalidateSession(userId);
        throw new Error(
          "ICICI session expired. Re-authentication required."
        );
      }

      if (status === 403) {
        throw new Error(
          "ICICI access denied (403).\n" +
            "Possible causes:\n" +
            "• Server IP not whitelisted\n" +
            "• Invalid API credentials\n" +
            "• Checksum mismatch\n" +
            "• Session token invalid"
        );
      }
    }

    throw error;
  }
}

/* ======================================================
   LOGIN URL (PURE API CONTRACT)
====================================================== */
export function getBreezeLoginUrl(runtimeAppKey: string): string {
  return `https://api.icicidirect.com/apiuser/login?api_key=${encodeURIComponent(
    runtimeAppKey
  )}`;
}

/* ======================================================
   CUSTOMER DETAILS HELPER (AUTH FLOW ONLY)
====================================================== */
export async function getCustomerDetails(
  userId: string,
  reqApiSession: string
) {
  return breezeRequest(userId, "POST", "/api/v1/customerdetails", {
    SessionToken: reqApiSession,
  });
}
