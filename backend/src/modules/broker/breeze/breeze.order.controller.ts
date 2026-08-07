// backend/src/controllers/iciciOrderController.ts
/**
 * ICICI Order Controller - Handles all order-related HTTP requests
 *
 * Integrates with:
 * - SessionService: Redis-cached ICICI session validation (~5ms)
 * - iciciOrderService: Named exports for Breeze API wrappers
 *
 * All methods are instance-based for clean dependency management
 */

import { Response } from "express";
import { AuthRequest } from "../../../shared/middleware/auth.js";
import * as ICICIOrderService from "./breeze.order-service.js";
import { SessionService } from "./breeze.session-service.js";

export class ICICIOrderController {
  private readonly sessionService = SessionService.getInstance();

  // ---------------- PLACE ORDER ----------------
  async placeOrder(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.userId;
      await this.sessionService.getSessionOrThrow(userId);

      const result = await ICICIOrderService.placeOrder(userId, req.body);
      res.json({ success: true, data: result });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to place order";
      res.status(400).json({ success: false, error: message });
    }
  }

  // ---------------- MODIFY ORDER ----------------
  async modifyOrder(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.userId;
      await this.sessionService.getSessionOrThrow(userId);

      const result = await ICICIOrderService.modifyOrder(userId, req.body);
      res.json({ success: true, data: result });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to modify order";
      res.status(400).json({ success: false, error: message });
    }
  }

  // ---------------- CANCEL ORDER ----------------
  async cancelOrder(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.userId;
      await this.sessionService.getSessionOrThrow(userId);

      const { exchangeCode = "NSE", orderId } = req.body;

      if (!orderId) {
        return res.status(400).json({ success: false, error: "orderId is required" });
      }

      const result = await ICICIOrderService.cancelOrder(userId, exchangeCode, orderId);
      res.json({ success: true, data: result });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to cancel order";
      res.status(400).json({ success: false, error: message });
    }
  }

  // ---------------- ORDER BOOK ----------------
  async getOrderBook(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.userId;
      await this.sessionService.getSessionOrThrow(userId);

      const result = await ICICIOrderService.getOrders(userId, "NSE", "", "");
      res.json({ success: true, data: result });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to fetch order book";
      res.status(400).json({ success: false, error: message });
    }
  }

  // ---------------- POSITIONS ----------------
  async getPositions(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.userId;
      await this.sessionService.getSessionOrThrow(userId);

      const result = await ICICIOrderService.getPositions(userId);
      res.json({ success: true, data: result });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to fetch positions";
      res.status(400).json({ success: false, error: message });
    }
  }

  // ---------------- HOLDINGS ----------------
  async getHoldings(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.userId;
      await this.sessionService.getSessionOrThrow(userId);

      const { exchangeCode = "NSE" } = req.query;
      const result = await ICICIOrderService.getHoldings(userId, exchangeCode as string);
      res.json({ success: true, data: result });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to fetch holdings";
      res.status(400).json({ success: false, error: message });
    }
  }
}
