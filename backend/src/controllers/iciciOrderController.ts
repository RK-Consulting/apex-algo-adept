// backend/src/controllers/iciciOrderController.ts

import { Request, Response } from "express";
import { AuthRequest } from "../middleware/auth.js";
import { ICICIOrderService } from "../services/iciciOrderService.js";
import { SessionService } from '../services/sessionService.js';

export class ICICIOrderController {
  private orderService = new ICICIOrderService();

  // ---------------- PLACE ORDER ----------------
  static async placeOrder(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.userId;
      const session = await SessionService.getInstance().getSessionOrThrow(userId);
      const data = await this.orderService.placeOrder(userId, req.body, session);
      return res.json({ success: true, data });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ---------------- MODIFY ORDER ----------------
  static async modifyOrder(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.userId;
      const session = await SessionService.getInstance().getSessionOrThrow(userId);
      const data = await this.orderService.modifyOrder(userId, req.body, session);
      return res.json({ success: true, data });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ---------------- CANCEL ORDER ----------------
  static async cancelOrder(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.userId;
      const session = await SessionService.getInstance().getSessionOrThrow(userId);
      const data = await this.orderService.cancelOrder(userId, req.body, session);
      return res.json({ success: true, data });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ---------------- ORDER BOOK ----------------
  static async orderbook(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.userId;
      const session = await SessionService.getInstance().getSessionOrThrow(userId);
      const data = await this.orderService.getOrderBook(userId, req.body, session);
      return res.json({ success: true, data });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ---------------- POSITIONS ----------------
  static async positions(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.userId;
      const session = await SessionService.getInstance().getSessionOrThrow(userId);
      const data = await this.orderService.getPositions(userId, req.body, session);
      return res.json({ success: true, data });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ---------------- HOLDINGS ----------------
  static async holdings(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.userId;
      const session = await SessionService.getInstance().getSessionOrThrow(userId);
      const data = await this.orderService.getHoldings(userId, req.body, session);
      return res.json({ success: true, data });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
}
