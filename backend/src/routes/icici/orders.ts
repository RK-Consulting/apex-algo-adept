// backend/src/routes/icici/orders.ts
import { Router } from "express";
import { authenticateToken } from "../../middleware/auth.js";
import { iciciLimiter } from "../../middleware/rateLimiter.js";
import { AuthRequest } from "../../middleware/auth.js";
import { ICICIOrderController } from "../../controllers/iciciOrderController.js";
import * as ICICIOrderService from "../../services/iciciOrderService.js"; // Namespace import for read operations

const router = Router();
const orderController = new ICICIOrderController();

/**
 * All ICICI Order Routes
 *
 * Protected by:
 * - JWT authentication (authenticateToken)
 * - Dedicated rate limiting (iciciLimiter)
 *
 * Write operations (place/modify/cancel) use controller for consistency
 * Read operations use service directly for simplicity and performance
 */

router.use(authenticateToken, iciciLimiter);

// Place new order
router.post("/place", async (req: AuthRequest, res, next) => {
  try {
    await orderController.placeOrder(req, res);
  } catch (error) {
    next(error);
  }
});

// Modify an existing order
router.put("/modify", async (req: AuthRequest, res, next) => {
  try {
    await orderController.modifyOrder(req, res);
  } catch (error) {
    next(error);
  }
});

// Cancel an order
router.delete("/cancel", async (req: AuthRequest, res, next) => {
  try {
    await orderController.cancelOrder(req, res);
  } catch (error) {
    next(error);
  }
});

// Get order history (date range)
router.get("/history", async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;
    const { fromDate = "", toDate = "" } = req.query;
    const result = await ICICIOrderService.getOrders(
      userId,
      "NSE", // Default exchange — can be made dynamic if needed
      fromDate as string,
      toDate as string
    );
    res.json({ success: true, data: result });
  } catch (error: any) {
    next(error);
  }
});

// Get current/active orders
router.get("/list", async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;
    const result = await ICICIOrderService.getOrders(
      userId,
      "NSE",
      new Date().toISOString().split("T")[0], // Today
      new Date().toISOString().split("T")[0]
    );
    res.json({ success: true, data: result });
  } catch (error: any) {
    next(error);
  }
});

// Get specific order detail
router.get("/detail/:orderId", async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;
    const { orderId } = req.params;
    const result = await ICICIOrderService.getOrderDetail(userId, "NSE", orderId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    next(error);
  }
});

export default router;
