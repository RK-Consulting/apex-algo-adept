// backend/src/routes/icici/orders.ts
import { Router } from "express";
import { authenticateToken, AuthRequest } from "../../middleware/auth.js";
//import { getBreezeInstance } from "../../utils/breezeSession.js";
import breezeSession from "../../utils/breezeSession.js";
import { mapSymbolForBreeze } from "../../utils/symbolMapper.js";
import debug from "debug";

const router = Router();
const log = debug("apex:icici:orders");
const { getBreezeInstance } = breezeSession;
/**
 * POST /api/icici/order
 * Place a new order
 */
router.post("/order", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;   // ✅ FIXED

    const {
      stockCode,
      exchangeCode = "NSE",
      productType = "cash",
      action = "buy",
      orderType = "market",
      quantity = "1",
      price = "",
      validity = "day",
    } = req.body;

    if (!stockCode) {
      return res.status(400).json({ error: "stockCode is required" });
    }

    const mapped = mapSymbolForBreeze(stockCode);
    const breeze = await getBreezeInstance(userId);

    const payload: any = {
      stockCode: mapped.payload,
      exchangeCode,
      productType,
      action,
      orderType,
      quantity: String(quantity),
      validity,
    };

    if (price) payload.price = String(price);

    log("📨 Order payload:", payload);

    const order = await breeze.placeOrder(payload);

    return res.json({ success: true, order });
  } catch (err: any) {
    log("Order placement failed:", err);
    return res.status(500).json({
      error: "Order placement failed",
      details: err?.message || err,
    });
  }
});

/**
 * GET /api/icici/orders
 * Get user's order history (past 7 days)
 */
router.get("/orders", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;   // ✅ FIXED

    const breeze = await getBreezeInstance(userId);

    const orders = await breeze.getOrderList();

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const recentOrders = (orders || []).filter((order: any) => {
      const t =
        order.order_date ||
        order.transaction_time ||
        order.time_stamp ||
        order.orderTimestamp ||
        null;

      if (!t) return false;

      const ts = new Date(t).getTime();
      return ts >= sevenDaysAgo;
    });

    return res.json({ success: true, orders: recentOrders });
  } catch (err: any) {
    log("Failed to fetch orders:", err);
    return res.status(500).json({
      error: "Failed to fetch orders",
      details: err?.message || err,
    });
  }
});

export { router as iciciOrdersRouter };
