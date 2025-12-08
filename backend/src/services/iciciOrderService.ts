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

  static async placeOrder(userId: string, body: any) {
    const res = await fetch(`${BASE}/placeorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: await this.jwt(userId) },
      body: JSON.stringify(body),
    });

    const json = await res.json();
    if (!res.ok) throw new Error(json.error || json.status || "Order failed");
    return json;
  }

  static async modifyOrder(userId: string, body: any) {
    const res = await fetch(`${BASE}/modifyorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: await this.jwt(userId) },
      body: JSON.stringify(body),
    });

    return res.json();
  }

  static async cancelOrder(userId: string, body: any) {
    const res = await fetch(`${BASE}/cancelorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: await this.jwt(userId) },
      body: JSON.stringify(body),
    });

    return res.json();
  }

  static async getOrderBook(userId: string) {
    const res = await fetch(`${BASE}/orderbook`, {
      headers: { Authorization: await this.jwt(userId) },
    });
    return res.json();
  }

  static async getPositions(userId: string) {
    const res = await fetch(`${BASE}/positions`, {
      headers: { Authorization: await this.jwt(userId) },
    });
    return res.json();
  }

  static async getHoldings(userId: string) {
    const res = await fetch(`${BASE}/holdings`, {
      headers: { Authorization: await this.jwt(userId) },
    });
    return res.json();
  }
}
