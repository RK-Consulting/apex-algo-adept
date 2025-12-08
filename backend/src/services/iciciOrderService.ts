// backend/services/iciciOrderService.ts
import axios from "axios";
import { getBreezeInstance } from "../utils/breezeSession.js";
import { query } from "../config/database.js";

const BASE_URL = "https://api.icicidirect.com/breezeapi/api/v1";

function authHeaders(jwt: string, appKey: string, timestamp: string, checksum: string) {
  return {
    "Content-Type": "application/json",
    "X-SessionToken": jwt,
    "X-AppKey": appKey,
    "X-Timestamp": timestamp,
    "X-Checksum": "token " + checksum,
  };
}

/** ---------------------------------------------------------
 * Utility: generate timestamp + checksum
 * -------------------------------------------------------- */
import crypto from "crypto";

function isoTimestamp(): string {
  const iso = new Date().toISOString();
  return iso.slice(0, 19) + ".000Z";
}

function computeChecksum(timestamp: string, body: string, secret: string) {
  return crypto.createHash("sha256").update(timestamp + body + secret).digest("hex");
}

/** ---------------------------------------------------------
 * SERVICE MODULE
 * -------------------------------------------------------- */
export class ICICIOrderService {
  static async placeOrder(userId: string, payload: any) {
    const breeze = await getBreezeInstance(userId);

    const appKey = process.env.ICICI_APP_KEY!;
    const secretKey = process.env.ICICI_SECRET_KEY!;
    const jwt = breeze.sessionToken || breeze.jwtToken;

    const timestamp = isoTimestamp();
    const body = JSON.stringify(payload);
    const checksum = computeChecksum(timestamp, body, secretKey);

    const resp = await axios.post(`${BASE_URL}/order`, payload, {
      headers: authHeaders(jwt, appKey, timestamp, checksum),
    });

    return resp.data;
  }

  static async modifyOrder(userId: string, payload: any) {
    const breeze = await getBreezeInstance(userId);

    const appKey = process.env.ICICI_APP_KEY!;
    const secretKey = process.env.ICICI_SECRET_KEY!;
    const jwt = breeze.sessionToken || breeze.jwtToken;

    const timestamp = isoTimestamp();
    const body = JSON.stringify(payload);
    const checksum = computeChecksum(timestamp, body, secretKey);

    const resp = await axios.post(`${BASE_URL}/order/modify`, payload, {
      headers: authHeaders(jwt, appKey, timestamp, checksum),
    });

    return resp.data;
  }

  static async cancelOrder(userId: string, payload: any) {
    const breeze = await getBreezeInstance(userId);

    const appKey = process.env.ICICI_APP_KEY!;
    const secretKey = process.env.ICICI_SECRET_KEY!;
    const jwt = breeze.sessionToken || breeze.jwtToken;

    const timestamp = isoTimestamp();
    const body = JSON.stringify(payload);
    const checksum = computeChecksum(timestamp, body, secretKey);

    const resp = await axios.post(`${BASE_URL}/order/cancel`, payload, {
      headers: authHeaders(jwt, appKey, timestamp, checksum),
    });

    return resp.data;
  }

  static async orderbook(userId: string) {
    const breeze = await getBreezeInstance(userId);

    const appKey = process.env.ICICI_APP_KEY!;
    const secretKey = process.env.ICICI_SECRET_KEY!;
    const jwt = breeze.sessionToken || breeze.jwtToken;

    const timestamp = isoTimestamp();
    const body = "";
    const checksum = computeChecksum(timestamp, body, secretKey);

    const resp = await axios.get(`${BASE_URL}/orderbook`, {
      headers: authHeaders(jwt, appKey, timestamp, checksum),
    });

    return resp.data;
  }

  static async positions(userId: string) {
    const breeze = await getBreezeInstance(userId);

    const appKey = process.env.ICICI_APP_KEY!;
    const secretKey = process.env.ICICI_SECRET_KEY!;
    const jwt = breeze.sessionToken || breeze.jwtToken;

    const timestamp = isoTimestamp();
    const checksum = computeChecksum(timestamp, "", secretKey);

    const resp = await axios.get(`${BASE_URL}/portfolio/positions`, {
      headers: authHeaders(jwt, appKey, timestamp, checksum),
    });

    return resp.data;
  }

  static async holdings(userId: string) {
    const breeze = await getBreezeInstance(userId);

    const appKey = process.env.ICICI_APP_KEY!;
    const secretKey = process.env.ICICI_SECRET_KEY!;
    const jwt = breeze.sessionToken || breeze.jwtToken;

    const timestamp = isoTimestamp();
    const checksum = computeChecksum(timestamp, "", secretKey);

    const resp = await axios.get(`${BASE_URL}/portfolio/holdings`, {
      headers: authHeaders(jwt, appKey, timestamp, checksum),
    });

    return resp.data;
  }
}
