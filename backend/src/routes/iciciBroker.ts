// src/routes/iciciBroker.ts
import { Router } from "express";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { query } from "../config/database.js";
import { BreezeConnect } from "breezeconnect"; // official SDK

const router = Router();

/**
 * Helper — create a Breeze instance using the user’s stored credentials
 */
async function getBreezeInstance(userId: string): Promise<BreezeConnect> {
  const { rows } = await query(
    `SELECT icici_api_key, icici_api_secret, icici_session_token
     FROM user_credentials WHERE user_id = $1`,
    [userId]
  );

  if (rows.length === 0) {
    throw new Error("ICICI Breeze credentials not found — please connect first.");
  }

  const { icici_api_key, icici_api_secret, icici_session_token } = rows[0];

  if (!icici_api_key || !icici_api_secret) {
    throw new Error("Incomplete ICICI credentials — please re‑authenticate.");
  }

  // ---- NEW SDK INITIALISATION ----
  const breeze = new BreezeConnect();          // no args
  breeze.setApiKey(icici_api_key);             // set appKey
  // generateSession needs **only** the secret (session token is returned)
  await breeze.generateSession(icici_api_secret);
  // If you have a cached session token you can set it:
  if (icici_session_token) breeze.setSessionToken(icici_session_token);

  return breeze;
}

/* --------------------------------------------------------------
   POST /api/icici/connect
   Save user’s ICICI Breeze API credentials
-------------------------------------------------------------- */
router.post("/connect", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { api_key, api_secret, session_token } = req.body;
    if (!api_key || !api_secret || !session_token) {
      return res.status(400).json({ error: "All fields required." });
    }

    await query(
      `INSERT INTO user_credentials (user_id, icici_api_key, icici_api_secret, icici_session_token)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id)
       DO UPDATE SET icici_api_key = $2, icici_api_secret = $3,
                     icici_session_token = $4, updated_at = NOW()`,
      [req.user!.id, api_key, api_secret, session_token]
    );

    res.json({ success: true, message: "ICICI credentials stored." });
  } catch (err) {
    console.error("ICICI Connect Error:", err);
    next(err);
  }
});

/* --------------------------------------------------------------
   GET /api/icici/funds
   Fetch available funds
-------------------------------------------------------------- */
router.get("/funds", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const breeze = await getBreezeInstance(req.user!.id);
    const funds = await breeze.getFunds();          // correct method
    res.json({ success: true, funds });
  } catch (err) {
    console.error("Fetch Funds Error:", err);
    next(err);
  }
});

/* --------------------------------------------------------------
   GET /api/icici/portfolio
   Get holdings
-------------------------------------------------------------- */
router.get("/portfolio", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const breeze = await getBreezeInstance(req.user!.id);
    const portfolio = await breeze.getHoldings();   // correct method
    res.json({ success: true, portfolio });
  } catch (err) {
    console.error("Portfolio Fetch Error:", err);
    next(err);
  }
});

/* --------------------------------------------------------------
   GET /api/icici/orders
   Get order history (last 7 days)
-------------------------------------------------------------- */
router.post("/order", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const breeze = await getBreezeInstance(req.user!.id);

    const {
      stockCode,
      exchangeCode = "NSE",
      productType = "cash",
      action = "buy",
      orderType = "market",
      quantity = "1",
      price = "",
      validity = "day",
    } = req.body as {
      stockCode?: string;
      exchangeCode?: string;
      productType?: string;
      action?: string;
      orderType?: string;
      quantity?: string | number;
      price?: string | number;
      validity?: string;
    };

    if (!stockCode) {
      return res.status(400).json({ error: "stockCode is required." });
    }

    const order = await breeze.placeOrder({
      stockCode,
      exchangeCode,
      productType,
      action,
      orderType,
      quantity: String(quantity),
      price: price ? String(price) : undefined,
      validity,
      //userRemark: "AlphaForge Order",
    });

    res.json({ success: true, order });
  } catch (err: any) {
    console.error("Place Order Error:", err.message || err);
    res.status(500).json({ error: "Order placement failed", details: err.message });
    next(err);
  }
});
/* --------------------------------------------------------------
   POST /api/icici/order
   Place a new order
-------------------------------------------------------------- */
router.post("/order", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const breeze = await getBreezeInstance(req.user!.id);
    const {
      stockCode,
      exchangeCode = "NSE",
      productType = "cash",          // renamed from `product`
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
      productType,
      action,
      orderType,
      quantity,
      price: price ? String(price) : undefined,
      validity,
      disclosedQuantity: undefined,
      stoploss: undefined,
      triggerPrice: undefined,
      //userRemark: "AlphaForge Order",
    });

    res.json({ success: true, order });
  } catch (err) {
    console.error("Place Order Error:", err);
    next(err);
  }
});

/* --------------------------------------------------------------
   DELETE /api/icici/order/:orderId
   Cancel an order
-------------------------------------------------------------- */
router.delete("/order/:orderId", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { orderId } = req.params;
    if (!orderId) return res.status(400).json({ error: "orderId required" });

    const breeze = await getBreezeInstance(req.user!.id);
    const response = await breeze.cancelOrder({ orderId }); // only orderId

    res.json({ success: true, response });
  } catch (err) {
    console.error("Cancel Order Error:", err);
    next(err);
  }
});

/* --------------------------------------------------------------
   GET /api/icici/quote/:symbol
   Live quote
-------------------------------------------------------------- */
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
    console.error("Get Quote Error:", err);
    next(err);
  }
});

/* --------------------------------------------------------------
   GET /api/icici/stream
   WebSocket live feed (demo – returns immediately)
-------------------------------------------------------------- */
router.get("/stream", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const breeze = await getBreezeInstance(req.user!.id);
    breeze.connect();                     // correct method

    breeze.on("message", (ticks: any) => {
      console.log("Ticks:", ticks);
      // You could push to a socket.io room, SSE, etc.
    });

    breeze.on("open", () => {
      console.log("WebSocket opened");
      // Example subscription
      breeze.subscribeFeeds({
        stockCode: "RELIANCE",
        exchangeCode: "NSE",
        productType: "cash",
      });
    });

    res.json({ success: true, message: "WebSocket started (check server logs)" });
  } catch (err) {
    console.error("WebSocket Error:", err);
    next(err);
  }
});

export { router as iciciBrokerRouter };
