// backend/services/iciciOrderService.ts
// backend/src/services/iciciOrderService.ts

import fetch from "node-fetch";
import { getSessionForUser } from "../utils/breezeSession.js";
import crypto from "crypto";

const BASE_URL = "https://api.icicidirect.com/breezeapi/api/v1";

export class ICICIOrderService {

  static async getJwt(userId: string) {
    const session = await getSessionForUser(userId);

    if (!session?.jwtToken) {
      throw new Error("ICICI session expired. Please reconnect.");
    }

    return session.jwtToken;
  }

  static async placeOrder(userId: string, payload: any) {
    const jwt = await this.getJwt(userId);

    const res = await fetch(`${BASE_URL}/placeorder`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: jwt,
      },
      body: JSON.stringify(payload),
    });

    const json = await res.json();

    if (!res.ok) throw new Error(json?.Error || "Order placement failed");

    return json;
  }

  static async modifyOrder(userId: string, payload: any) {
    const jwt = await this.getJwt(userId);

    const res = await fetch(`${BASE_URL}/modifyorder`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: jwt,
      },
      body: JSON.stringify(payload),
    });

    return res.json();
  }

  static async cancelOrder(userId: string, payload: any) {
    const jwt = await this.getJwt(userId);

    const res = await fetch(`${BASE_URL}/cancelorder`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: jwt,
      },
      body: JSON.stringify(payload),
    });

    return res.json();
  }

  static async getOrderBook(userId: string) {
    const jwt = await this.getJwt(userId);

    const res = await fetch(`${BASE_URL}/orderbook`, {
      headers: { Authorization: jwt },
    });

    return res.json();
  }

  static async getPositions(userId: string) {
    const jwt = await this.getJwt(userId);

    const res = await fetch(`${BASE_URL}/positions`, {
      headers: { Authorization: jwt },
    });

    return res.json();
  }

  static async getHoldings(userId: string) {
    const jwt = await this.getJwt(userId);

    const res = await fetch(`${BASE_URL}/holdings`, {
      headers: { Authorization: jwt },
    });

    return res.json();
  }
}
