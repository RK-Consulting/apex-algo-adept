import { Router } from "express";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { query } from "../config/database.js";
import { BreezeConnect } from "breezeconnect";

const router = Router();

/**
 * Helper: Create Breeze session for a user
 */
async function getBreezeInstance(userId: string): Promise<any> {
  const creds = await query(
    `SELECT icici_api_key, icici_api_secret, icici_token 
     FROM user_credentials WHERE user_id = $1`,
    [userId]
  );

  if (creds.rows.length === 0) {
    throw new Error("ICICI credentials not found. Please log in first.");
  }

  const { icici_api_key, icici_api_secret, icici_token } = creds.rows[0];

  const breeze = new BreezeConnect();
  await breeze.generateSession(icici_api_key, icici_api_secret);
  breeze.setToken(icici_token);

  return breeze;
}

/**
 * @route POST /api/icici/login
 * @desc Authenticate and store ICICI Direct Breeze credentials
 */
router.post("/login", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { apiKey, apiSecret } = req.body;
    if (!apiKey || !apiSecret) {
      return res.status(400).json({ error: "Missing ICICI API credentials" });
    }

    const breeze = new BreezeConnect();
    const sessionResponse = await breeze.generateSession(apiKey, apiSecret);

    const token =
      sessionResponse?.data?.session_token || sessionResponse?.session_token;
    if (!token) {
      return res.status(400).json({
        error: "Failed to retrieve session token",
        details: sessionResponse,
      });
    }

    await query(
      `UPDATE user_credentials 
       SET icici_api_key = $1, icici_api_secret = $2, icici_token = $3 
       WHERE user_id = $4`,
      [apiKey, apiSecret, token, req.user!.id]
    );

    res.json({ success: true, message: "ICICI login successful", token });
  } catch (error) {
    console.error("❌ ICICI Login Error:", error);
    next(error);
  }
});

/**
 * @route GET /api/icici/portfolio
 * @desc Fetch portfolio holdings
 */
router.get("/portfolio", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const breeze = await getBreezeInstance(req.user!.id);
    const portfolio = await breeze.getPortfolioHoldings();
    res.json({ success: true, portfolio });
  } catch (error) {
    console.error("❌ Portfolio Error:", error);
    next(error);
  }
});

/**
 * @route GET /api/icici/orders
 * @desc Fetch user's order list
 */
router.get("/orders", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const breeze = await getBreezeInstance(req.user!.id);
    const orders = await breeze.getOrderList();
    res.json({ success: true, orders });
  } catch (error) {
    console.error("❌ Get Orders Error:", error);
    next(error);
  }
});

/**
 * @route POST /api/icici/order
 * @desc Place a new order
 */
router.post("/order", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const breeze = await getBreezeInstance(req.user!.id);

    const {
      stock_code,
      exchange_code = "NSE",
      product = "cash",
      action = "buy",
      order_type = "market",
      quantity = 1,
      price = "0",
      validity = "day",
    } = req.body;

    if (!stock_code) {
      return res.status(400).json({ error: "Missing stock_code" });
    }

    const order = await breeze.placeOrder({
      stock_code,
      exchange_code,
      product,
      action,
      order_type,
      quantity,
      price,
      validity,
      validity_date: new Date().toISOString(),
      user_remark: "AlphaForge Order",
    });

    res.json({ success: true, order });
  } catch (error) {
    console.error("❌ Place Order Error:", error);
    next(error);
  }
});

/**
 * @route DELETE /api/icici/order/:orderId
 * @desc Cancel an existing order
 */
router.delete("/order/:orderId", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const breeze = await getBreezeInstance(req.user!.id);
    const { orderId } = req.params;

    if (!orderId) {
      return res.status(400).json({ error: "Missing orderId" });
    }

    const cancelResponse = await breeze.cancelOrder({
      exchange_code: "NSE",
      order_id: orderId,
    });

    res.json({ success: true, cancelResponse });
  } catch (error) {
    console.error("❌ Cancel Order Error:", error);
    next(error);
  }
});

export { router as iciciBrokerRouter };
