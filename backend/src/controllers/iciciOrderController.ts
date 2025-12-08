// backend/controllers/iciciOrderController.ts
import { Request, Response } from "express";
import { ICICIOrderService } from "../services/iciciOrderService.js";

export class ICICIOrderController {
  static async placeOrder(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const data = await ICICIOrderService.placeOrder(userId, req.body);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message, detail: err?.response?.data });
    }
  }

  static async modifyOrder(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const data = await ICICIOrderService.modifyOrder(userId, req.body);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message, detail: err?.response?.data });
    }
  }

  static async cancelOrder(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const data = await ICICIOrderService.cancelOrder(userId, req.body);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message, detail: err?.response?.data });
    }
  }

  static async orderbook(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const data = await ICICIOrderService.orderbook(userId);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  static async positions(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const data = await ICICIOrderService.positions(userId);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  static async holdings(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const data = await ICICIOrderService.holdings(userId);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
}
