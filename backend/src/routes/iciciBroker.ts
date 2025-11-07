import { Router } from "express";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { query } from "../config/database.js";
import { BreezeConnect } from "breezeconnect"; // ✅ modern import style

const router = Router();

/**
 * 🧠 Helper — Create Breeze Instance with user's stored credentials
 */
async function getBreezeInstance(userId: string) {
  const { rows } = await query(
    `SELECT icici_api_key, icici_api_secret, icici_session_token
     FROM user_credentials WHERE user_id = $1`,
    [userId]
  );

  if (rows.length === 0) {
    throw new Error("ICICI Breeze credentials not found — please connect first.");
  }

  const { icici_api_key, icici_api_secret, icici_session_token } = rows[0];
  if (!icici_api_key || !icici_api_secret || !icici_session_token) {
    throw new Error("Incomplete ICICI credentials — please reauthenticate.");
  }

  //const breeze = new BreezeConnect({ appKey: icici_api_key });
  //await breeze.generateSession(icici_api_secret, icici_session_token);
  const breeze = new BreezeConnect();
  await breeze.generateSession(icici_api_key, icici_api_secret);
  return breeze;
}

/**
 * @route POST /api/icici/connect
 * 🔐 Save user’s ICICI Breeze API credentials
 */
router.post("/connect", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { api_key, api_secret, session_token } = req.body;

    if (!api_key || !api_secret || !session_token) {
      return res.status(400).json({ error: "All fields (api_key, api_secret, session_token) are required." });
    }

    // store or update in DB
    await query(
      `INSERT INTO user_credentials (user_id, icici_api_key, icici_api_secret, icici_session_token)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id)
       DO UPDATE SET icici_api_key = $2, icici_api_secret = $3, icici_session_token = $4, updated_at = NOW()`,
      [req.user!.id, api_key, api_secret, session_token]
    );

    res.json({ success: true, message: "ICICI Direct Breeze credentials stored successfully." });
  } catch (err) {
    console.error("❌ ICICI Connect Error:", err);
    next(err);
  }
});

/**
 * @route GET /api/icici/funds
 * 💰 Fetch available funds
 */
router.get("/funds", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const breeze = await getBreezeInstance(req.user!.id);
    const funds = await breeze.getFundDetails();
    res.json({ success: true, funds });
  } catch (err) {
    console.error("❌ Fetch Funds Error:", err);
    next(err);
  }
});

/**
 * @route GET /api/icici/portfolio
 * 📊 Get portfolio holdings
 */
router.get("/portfolio", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const breeze = await getBreezeInstance(req.user!.id);
    const portfolio = await breeze.Holdings();
    res.json({ success: true, portfolio });
  } catch (err) {
    console.error("❌ Portfolio Fetch Error:", err);
    next(err);
  }
});

/**
 * @route GET /api/icici/orders
 * 📜 Get order history
 */
router.get("/orders", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const breeze = await getBreezeInstance(req.user!.id);
    const today = new Date();
    const fromDate = new Date(today);
    fromDate.setDate(today.getDate() - 7);

    const orders = await breeze.getOrderList({
      exchangeCode: "NSE",
      fromDate: fromDate.toISOString(),
      toDate: today.toISOString(),
    });

    res.json({ success: true, orders });
  } catch (err) {
    console.error("❌ Get Orders Error:", err);
    next(err);
  }
});

/**
 * @route POST /api/icici/order
 * 🟢 Place a new order
 */
router.post("/order", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const breeze = await getBreezeInstance(req.user!.id);
    const {
      stockCode,
      exchangeCode = "NSE",
      product = "cash",
      action = "buy",
      orderType = "market",
      quantity = "1",
      price = "",
      validity = "day",
    } = req.body;

    if (!stockCode) {
      return res.status(400).json({ error: "stockCode is required." });
    }

    const order = await breeze.placeOrder({
      stockCode,
      exchangeCode,
      product,
      action,
      orderType,
      quantity,
      price,
      validity,
      validityDate: new Date().toISOString(),
      userRemark: "AlphaForge Order",
    });

    res.json({ success: true, order });
  } catch (err) {
    console.error("❌ Place Order Error:", err);
    next(err);
  }
});

/**
 * @route DELETE /api/icici/order/:orderId
 * 🔴 Cancel order
 */
router.delete("/order/:orderId", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { orderId } = req.params;
    if (!orderId) return res.status(400).json({ error: "orderId required" });

    const breeze = await getBreezeInstance(req.user!.id);
    const response = await breeze.cancelOrder({
      exchangeCode: "NSE",
      orderId,
    });

    res.json({ success: true, response });
  } catch (err) {
    console.error("❌ Cancel Order Error:", err);
    next(err);
  }
});

/**
 * @route GET /api/icici/quote/:symbol
 * 📈 Get live quote for stock
 */
router.get("/quote/:symbol", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { symbol } = req.params;
    if (!symbol) return res.status(400).json({ error: "symbol required" });

    const breeze = await getBreezeInstance(req.user!.id);
    const quote = await breeze.getQuotes({
      stockCode: symbol,
      exchangeCode: "NSE",
      productType: "cash",
    });

    res.json({ success: true, quote });
  } catch (err) {
    console.error("❌ Get Quote Error:", err);
    next(err);
  }
});

/**
 * @route GET /api/icici/stream
 * 🔄 (Future Use) Websocket live feed subscription endpoint
 */
router.get("/stream", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const breeze = await getBreezeInstance(req.user!.id);
    breeze.connect();

    /** breeze.onMessage = (ticks: any) => {
      console.log("📡 Ticks:", ticks);
    }; */
    // After calling breeze.connect()
    breeze.on('message', (ticks: any) => {
      console.log("Ticks:", ticks);
    });
    
    res.json({ success: true, message: "Live stream connected via Breeze WebSocket" });
  } catch (err) {
    console.error("❌ WebSocket Error:", err);
    next(err);
  }
});

export { router as iciciBrokerRouter };
