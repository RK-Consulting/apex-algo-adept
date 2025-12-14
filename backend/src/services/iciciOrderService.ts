// backend/src/services/iciciOrderService.ts

import fetch from "node-fetch";
import { getSessionForUser } from "../utils/breezeSession.js";
import { placeOrder as breezePlaceOrder, getOrders, cancelOrder } from './breezeClient';

const BASE = "https://api.icicidirect.com/breezeapi/api/v1";

export class ICICIOrderService {
  static async jwt(userId: string) {
    const session = await getSessionForUser(userId);
    if (!session?.jwtToken) throw new Error("ICICI session expired");
    return session.jwtToken;
  }

  // ---------------- PLACE ORDER ----------------
 // NEW CODE

export async function placeOrder(userId: string, orderData: any) {
  return await breezePlaceOrder(userId, orderData);
}

export async function getOrderList(userId: string, exchangeCode: string, fromDate: string, toDate: string) {
  return await getOrders(userId, exchangeCode, fromDate, toDate);
}

export async function cancelOrderById(userId: string, exchangeCode: string, orderId: string) {
  return await cancelOrder(userId, exchangeCode, orderId);
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
