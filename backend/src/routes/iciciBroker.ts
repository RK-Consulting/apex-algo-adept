// src/routes/iciciBroker.ts
import { Router } from "express";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { query } from "../config/database.js";
import { BreezeConnect } from "breezeconnect";

const router = Router();

/**
 * Helper: Create a Breeze instance using stored or .env credentials
 */
async function getBreezeInstance(userId: string): Promise<BreezeConnect> {
  const { rows } = await query(
    `SELECT icici_api_key, icici_api_secret, icici_session_token
     FROM user_credentials WHERE user_id = $1`,
    [userId]
  );

  let icici_api_key: string;
  let icici_api_secret: string;
  let icici_session_token: string;

  if (rows.length > 0) {
    ({ icici_api_key, icici_api_secret, icici_session_token } = rows[0]);
  } else {
    // fallback to .env
    icici_api_key = process.env.ICICI_API_KEY || "";
    icici_api_secret = process.env.ICICI_API_SECRET || "";
    icici_session_token = process.env.ICICI_SESSION_TOKEN || "";
  }

  if (!icici_api_key || !icici_api_secret) {
    throw new Error("Missing ICICI API credentials (api_key/api_secret).");
  }

  // ✅ Compatible with breezeconnect v1.0.29
  const breeze = new BreezeConnect();
  breeze.setApiKey(icici_api_key);

  // Generate a new session using secret only (this returns a token internally)
  const sessionData = await breeze.generateSession(icici_api_secret);

  // If you have a stored token, reuse it (optional)
  if (icici_session_token) {
    breeze.setSessionToken(icici_session_token);
  }

  console.log("✅ Breeze instance initialized for user:", userId);
  return breeze;
}



/* --------------------------------------------------------------
   POST /api/icici/connect
   Save user's ICICI credentials in database
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
       DO UPDATE SET icici_api_key = EXCLUDED.icici_api_key,
                     icici_api_secret = EXCLUDED.icici_api_secret,
                     icici_session_token = EXCLUDED.icici_session_token,
                     updated_at = NOW()`,
      [req.user!.id, api_key, api_secret, session_token]
    );

    res.json({ success: true, message: "ICICI credentials saved." });
  } catch (err) {
    console.error("ICICI Connect Error:", err);
    next(err);
  }
});

/* --------------------------------------------------------------
   GET /api/icici/funds
-------------------------------------------------------------- */
router.get("/funds", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const breeze = await getBreezeInstance(req.user!.id);
    const funds = await breeze.getFunds();
    res.json({ success: true, funds });
  } catch (err) {
    console.error("Fetch Funds Error:", err);
    next(err);
  }
});

/* --------------------------------------------------------------
   GET /api/icici/portfolio
-------------------------------------------------------------- */
router.get("/portfolio", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const breeze = await getBreezeInstance(req.user!.id);
    const portfolio = await breeze.getHoldings();
    res.json({ success: true, portfolio });
  } catch (err) {
    console.error("Portfolio Fetch Error:", err);
    next(err);
  }
});

/* --------------------------------------------------------------
   POST /api/icici/order
   Place an order
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
    });

    res.json({ success: true, order });
  } catch (err: any) {
    console.error("Place Order Error:", err.message || err);
    res.status(500).json({ error: "Order placement failed", details: err.message });
  }
});

/* --------------------------------------------------------------
   DELETE /api/icici/order/:orderId
-------------------------------------------------------------- */
router.delete("/order/:orderId", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const breeze = await getBreezeInstance(req.user!.id);
    const response = await breeze.cancelOrder({ orderId: req.params.orderId });
    res.json({ success: true, response });
  } catch (err) {
    console.error("Cancel Order Error:", err);
    next(err);
  }
});

/* --------------------------------------------------------------
   GET /api/icici/quote/:symbol
-------------------------------------------------------------- */
router.get("/quote/:symbol", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const breeze = await getBreezeInstance(req.user!.id);
    const quote = await breeze.getQuotes({
      stockCode: req.params.symbol,
      exchangeCode: "NSE",
      productType: "cash",
    });
    res.json({ success: true, quote });
  } catch (err) {
    console.error("Get Quote Error:", err);
    next(err);
  }
});

export { router as iciciBrokerRouter };
