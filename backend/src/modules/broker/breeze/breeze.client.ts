// backend/src/services/iciciBreezeApi.ts
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

import { calculateChecksum, getTimestamp } from "../../../shared/breezeChecksum.js";
import { SessionService } from "./breeze.session-service.js";
import { retryWithBackoff } from "../../../shared/retry.js";
import { iciciCircuitBreaker } from "../../../shared/circuitBreaker.js";

/* ======================================================
   CONSTANTS
====================================================== */
const ICICI_BASE_URL = "https://api.icicidirect.com";

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

    const runtimeAppKey = runtimeSession.api_key;
    const runtimeAppSecret = runtimeSession.api_secret;
    const runtimeSessionToken = runtimeSession.session_token;

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
      "X-Checksum": checksum,
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

    /* --------------------------------------------------
       Surgical Fix: Handle ICICI "Success with Error"
    -------------------------------------------------- */
    if (response.data?.Status && response.data.Status !== 200) {
      const errorMsg = response.data.Error || "Unknown Breeze Error";
      
      // If ICICI says session is expired within a 200 OK body
      if (errorMsg.includes("Session") || errorMsg.includes("Token")) {
        await SessionService.getInstance().invalidateSession(userId);
      }
      throw new Error(`Breeze API error: ${errorMsg}`);
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

      /* --------------------------------------------------
         Surgical Fix: Handle HTTP 401/403 Specifically
      -------------------------------------------------- */
      if (status === 401) {
        await SessionService.getInstance().invalidateSession(userId);
        throw new Error("ICICI session expired. Re-authentication required.");
      }

      if (status === 403) {
        throw new Error(
          "ICICI access denied (403).\n" +
            "Possible causes: IP Whitelisting, Invalid Credentials, or Checksum Mismatch."
        );
      }
    }

    throw error;
  }
}

/* ======================================================
   SESSION GENERATION (Institutional Handshake)
   Surgically cleaned to use correct JSONPostData format
====================================================== */
export async function generateIciciSession(
  userId: string,     // Your ICICI Trading ID (e.g., "NAGARROU")
  appKey: string,
  appSecret: string,
  apisession: string  // Token from redirect URL
) {
  const timestamp = getTimestamp();

  // 1. Manually stringify inner data (Case Sensitive for ICICI)
  const innerData = JSON.stringify({
    UserID: userId,
    API_Session: apisession,
    APPKey: appKey
  });

  // 2. Checksum = timestamp + innerData (the string) + secret
  const checksum = calculateChecksum(timestamp, innerData, appSecret);

  // 3. Request permanent SessionToken
  const response = await breezeAxios.post("/customer/customerdetails", {
    AppKey: appKey,
    time_stamp: timestamp,
    JSONPostData: innerData,
    Checksum: checksum
  });

  if (response.data?.Status !== 200) {
    throw new Error(response.data?.Error || "Session generation failed");
  }

  // Returns the permanent SessionToken for all future calls
  return response.data.Success.SessionToken;
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
export async function getCustomerDetails(appKey: string, appSecret: string, apisession: string) {
  const timestamp = getTimestamp();
  
  const innerData = JSON.stringify({
    UserID: "NAGARROU", // Consider making this dynamic if needed
    API_Session: apisession,
    APPKey: appKey
  });

  const checksum = calculateChecksum(timestamp, innerData, appSecret);

  const response = await breezeAxios.post("/customer/customerdetails", {
    AppKey: appKey,
    time_stamp: timestamp,
    JSONPostData: innerData,
    Checksum: checksum
  });
  
  return response.data;
}
