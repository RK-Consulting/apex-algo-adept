// backend/src/controllers/iciciOrderController.ts

import { Request, Response } from "express";
import { AuthRequest } from "../middleware/auth.js";
import { ICICIOrderService } from "../services/iciciOrderService.js";

export class ICICIOrderController {

  // ---------------- PLACE ORDER ----------------
  static async placeOrder(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.userId;
      const data = await ICICIOrderService.placeOrder(userId, req.body);
      return res.json({ success: true, data });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  // ---------------- MODIFY ORDER ----------------
  static async modifyOrder(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.userId;
      const data = await ICICIOrderService.modifyOrder(userId, req.body);
      return res.json({ success: true, data });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  // ---------------- CANCEL ORDER ----------------
  static async cancelOrder(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.userId;
      const data = await ICICIOrderService.cancelOrder(userId, req.body);
      return res.json({ success: true, data });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  // ---------------- ORDER BOOK ----------------
  static async orderbook(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.userId;
      const data = await ICICIOrderService.getOrderBook(userId);
      return res.json({ success: true, data });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  // ---------------- POSITIONS ----------------
  static async positions(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.userId;
      const data = await ICICIOrderService.getPositions(userId);
      return res.json({ success: true, data });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  // ---------------- HOLDINGS ----------------
  static async holdings(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.userId;
      const data = await ICICIOrderService.getHoldings(userId);
      return res.json({ success: true, data });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }
}
