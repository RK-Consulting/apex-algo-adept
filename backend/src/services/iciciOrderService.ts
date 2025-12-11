// backend/src/services/iciciOrderService.ts

import fetch from "node-fetch";
import { getSessionForUser } from "../utils/breezeSession.js";

const BASE = "https://api.icicidirect.com/breezeapi/api/v1";

export class ICICIOrderService {
  static async jwt(userId: string) {
    const session = await getSessionForUser(userId);
    if (!session?.jwtToken) throw new Error("ICICI session expired");
    return session.jwtToken;
  }

  // ---------------- PLACE ORDER ----------------
  static async placeOrder(userId: string, body: any) {
    const res = await fetch(`${BASE}/placeorder`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: await this.jwt(userId),
      },
      body: JSON.stringify(body),
    });

    const json: any = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg =
        json?.error ||
        json?.Error ||
        json?.message ||
        json?.status ||
        "Order failed";

      throw new Error(msg);
    }

    return json;
  }

  // ---------------- MODIFY ORDER ----------------
  static async modifyOrder(userId: string, body: any) {
    const res = await fetch(`${BASE}/modifyorder`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: await this.jwt(userId),
      },
      body: JSON.stringify(body),
    });

    const json: any = await res.json().catch(() => ({}));
    return json;
  }

  // ---------------- CANCEL ORDER ----------------
  static async cancelOrder(userId: string, body: any) {
    const res = await fetch(`${BASE}/cancelorder`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: await this.jwt(userId),
      },
      body: JSON.stringify(body),
    });

    const json: any = await res.json().catch(() => ({}));
    return json;
  }

  // ---------------- ORDER BOOK ----------------
  static async getOrderBook(userId: string) {
    const res = await fetch(`${BASE}/orderbook`, {
      headers: { Authorization: await this.jwt(userId) },
    });

    const json: any = await res.json().catch(() => ({}));
    return json;
  }

  // ---------------- POSITIONS ----------------
  static async getPositions(userId: string) {
    const res = await fetch(`${BASE}/positions`, {
      headers: { Authorization: await this.jwt(userId) },
    });

    const json: any = await res.json().catch(() => ({}));
    return json;
  }

  // ---------------- HOLDINGS ----------------
  static async getHoldings(userId: string) {
    const res = await fetch(`${BASE}/holdings`, {
      headers: { Authorization: await this.jwt(userId) },
    });

    const json: any = await res.json().catch(() => ({}));
    return json;
  }
}
