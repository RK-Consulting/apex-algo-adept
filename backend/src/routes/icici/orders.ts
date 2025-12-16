// backend/src/routes/icici/orders.ts
import { Router } from "express";
import { authenticateToken } from "../../middleware/auth.js";
import { iciciLimiter } from "../../middleware/rateLimiter.js";
import { AuthRequest } from "../../middleware/auth.js"; // Ensures req.user is typed
import { ICICIOrderController } from "../../controllers/iciciOrderController.js";

const router = Router();
const orderController = new ICICIOrderController();

/**
 * All ICICI Order Routes
 * 
 * Protected by:
 * - JWT authentication (authenticateToken)
 * - Dedicated rate limiting (iciciLimiter) to prevent abuse on order endpoints
 * 
 * Uses ICICIOrderController for clean separation of concerns
 * Integrates with SessionService for cached Breeze session retrieval
 */
router.use(authenticateToken, iciciLimiter);

// Place new order
router.post("/place", async (req: AuthRequest, res, next) => {
  try {
    await orderController.placeOrder(req, res);
  } catch (error) {
    next(error); // Forward to centralized errorHandler
  }
});

// Get order history (optional date filters)
router.get("/history", async (req: AuthRequest, res, next) => {
  try {
    await orderController.getOrderHistory(req, res);
  } catch (error) {
    next(error);
  }
});

// Get current day's/active orders
router.get("/list", async (req: AuthRequest, res, next) => {
  try {
    await orderController.getOrders(req, res);
  } catch (error) {
    next(error);
  }
});

// Get specific order details
router.get("/detail/:orderId", async (req: AuthRequest, res, next) => {
  try {
    await orderController.getOrderDetail(req, res);
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

// Modify an existing order
router.put("/modify", async (req: AuthRequest, res, next) => {
  try {
    await orderController.modifyOrder(req, res);
  } catch (error) {
    next(error);
  }
});

export default router;
