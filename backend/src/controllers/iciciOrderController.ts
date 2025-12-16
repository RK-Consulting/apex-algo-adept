// backend/src/controllers/iciciOrderController.ts
import { Response } from "express";
import { AuthRequest } from "../middleware/auth.js";
import ICICIOrderService from "../services/iciciOrderService.js"; // Default import (recommended)
import { SessionService } from "../services/sessionService.js";

/**
 * ICICIOrderController - Handles all order-related operations via Breeze API
 * 
 * Integrates with:
 * - SessionService: Redis-cached ICICI session retrieval (~5ms hits)
 * - ICICIOrderService: Direct Breeze API calls (place/modify/cancel/get)
 * 
 * All methods are instance-based for proper service injection and performance
 */
export class ICICIOrderController {
  private readonly orderService: ICICIOrderService;
  private readonly sessionService = SessionService.getInstance();

  constructor() {
    // Singleton/shared instance - efficient for high-frequency requests
    this.orderService = new ICICIOrderService();
  }

  // ---------------- PLACE ORDER ----------------
  async placeOrder(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const session = await this.sessionService.getSessionOrThrow(userId);

      const result = await this.orderService.placeOrder(userId, req.body, session);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message || "Failed to place order" });
    }
  }

  // ---------------- MODIFY ORDER ----------------
  async modifyOrder(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const session = await this.sessionService.getSessionOrThrow(userId);

      const result = await this.orderService.modifyOrder(userId, req.body, session);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message || "Failed to modify order" });
    }
  }

  // ---------------- CANCEL ORDER ----------------
  async cancelOrder(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const session = await this.sessionService.getSessionOrThrow(userId);

      const result = await this.orderService.cancelOrder(userId, req.body, session);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message || "Failed to cancel order" });
    }
  }

  // ---------------- ORDER BOOK (All Orders) ----------------
  async getOrderBook(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const session = await this.sessionService.getSessionOrThrow(userId);

      const result = await this.orderService.getOrderBook(userId, req.query, session);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message || "Failed to fetch order book" });
    }
  }

  // ---------------- POSITIONS ----------------
  async getPositions(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const session = await this.sessionService.getSessionOrThrow(userId);

      const result = await this.orderService.getPositions(userId, req.query, session);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message || "Failed to fetch positions" });
    }
  }

  // ---------------- HOLDINGS ----------------
  async getHoldings(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const session = await this.sessionService.getSessionOrThrow(userId);

      const result = await this.orderService.getHoldings(userId, req.query, session);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message || "Failed to fetch holdings" });
    }
  }

  // ---------------- ORDER HISTORY (Date Range) ----------------
  async getOrderHistory(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const session = await this.sessionService.getSessionOrThrow(userId);
      const { fromDate, toDate } = req.query;

      const result = await this.orderService.getOrderHistory(
        userId,
        fromDate as string,
        toDate as string,
        session
      );
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message || "Failed to fetch order history" });
    }
  }

  // ---------------- CURRENT ORDERS LIST ----------------
  async getOrders(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const session = await this.sessionService.getSessionOrThrow(userId);
      const { exchangeCode, fromDate, toDate } = req.query;

      const result = await this.orderService.getOrders(
        userId,
        exchangeCode as string,
        fromDate as string,
        toDate as string,
        session
      );
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message || "Failed to fetch orders" });
    }
  }

  // ---------------- ORDER DETAIL BY ID ----------------
  async getOrderDetail(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { orderId } = req.params;
      const { exchangeCode } = req.query;
      const session = await this.sessionService.getSessionOrThrow(userId);

      const result = await this.orderService.getOrderDetail(
        userId,
        exchangeCode as string,
        orderId,
        session
      );
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message || "Failed to fetch order detail" });
    }
  }
}
