// src/routes/iciciBroker.ts
import { Router } from "express";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { query } from "../config/database.js";
import { getBreezeInstance, invalidateBreezeInstance } from "../utils/breezeSession.js";
import { mapSymbolForBreeze } from "../utils/symbolMapper.js";
import debug from "debug";

const log = debug("apex:icici:broker");
const router = Router();

/* --------------------------------------------------------------
   POST /api/icici/connect
   Save user's ICICI credentials in database
-------------------------------------------------------------- */
router.post("/connect", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { api_key, api_secret, session_token, refresh_token } = req.body;

    if (!api_key || !api_secret || !session_token) {
      return res.status(400).json({ error: "api_key, api_secret, session_token required" });
    }

    await query(
      `INSERT INTO user_credentials 
       (user_id, icici_api_key, icici_api_secret, icici_session_token, refresh_token, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,NOW(),NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET 
         icici_api_key = EXCLUDED.icici_api_key,
         icici_api_secret = EXCLUDED.icici_api_secret,
         icici_session_token = EXCLUDED.icici_session_token,
         refresh_token = EXCLUDED.refresh_token,
         updated_at = NOW()`,
      [req.user!.id, api_key, api_secret, session_token, refresh_token || null]
    );

    // Clear cached Breeze instance for user
    invalidateBreezeInstance(req.user!.id);

    return res.json({ success: true, message: "ICICI credentials saved." });
  } catch (err: any) {
    log("ICICI Connect Error:", err);
    return res.status(500).json({ error: "ICICI connect failed", details: err.message });
  }
});

/* --------------------------------------------------------------
   GET /api/icici/funds
-------------------------------------------------------------- */
router.get("/funds", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const breeze = await getBreezeInstance(req.user!.id);
    const funds = await breeze.getFunds();
    return res.json({ success: true, funds });
  } catch (err: any) {
    log("Funds Fetch Error:", err);
    return res.status(500).json({ error: "Unable to fetch funds", details: err.message });
  }
});

/* --------------------------------------------------------------
   GET /api/icici/portfolio
-------------------------------------------------------------- */
router.get("/portfolio", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const breeze = await getBreezeInstance(req.user!.id);

    // Correct Portfolio API
    const holdings = await breeze.getPortfolioHoldings("NSE");

    return res.json({ success: true, holdings });
  } catch (err: any) {
    log("Portfolio Error:", err);
    return res.status(500).json({ error: "Unable to fetch portfolio", details: err.message });
  }
});

/* --------------------------------------------------------------
   POST /api/icici/order
   Place an order
-------------------------------------------------------------- */
router.post("/order", authenticateToken, async (req: AuthRequest, res) => {
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
      return res.status(400).json({ error: "stockCode is required" });
    }

    const mapped = mapSymbolForBreeze(stockCode);

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

    log("Order Payload:", payload);

    const response = await breeze.placeOrder(payload);

    return res.json({ success: true, order: response });
  } catch (err: any) {
    log("Order Error:", err);
    return res.status(500).json({ error: "Order failed", details: err.message });
  }
});

/* --------------------------------------------------------------
   DELETE /api/icici/order/:orderId
-------------------------------------------------------------- */
router.delete("/order/:orderId", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const breeze = await getBreezeInstance(req.user!.id);
    const response = await breeze.cancelOrder({ orderId: req.params.orderId });
    return res.json({ success: true, response });
  } catch (err: any) {
    log("Cancel Order Error:", err);
    return res.status(500).json({ error: "Cancel order failed", details: err.message });
  }
});

/* --------------------------------------------------------------
   GET /api/icici/quote/:symbol
-------------------------------------------------------------- */
router.get("/quote/:symbol", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const symbol = req.params.symbol;
    const mapped = mapSymbolForBreeze(symbol);
    const breeze = await getBreezeInstance(req.user!.id);

    let quote;

    if (mapped.type === "index") {
      // NIFTY, BANKNIFTY, SENSEX:
      if (typeof (breeze as any).getIndexQuotes === "function") {
        quote = await (breeze as any).getIndexQuotes({ index: mapped.payload });
      } else {
        // fallback (older SDK)
        quote = await breeze.getQuotes({
          stockCode: mapped.payload,
          exchangeCode: "NSE",
          productType: "cash",
        });
      }
    } else {
      // Stock quote
      quote = await breeze.getQuotes({
        stockCode: mapped.payload,
        exchangeCode: "NSE",
        productType: "cash",
      });
    }

    return res.json({ success: true, quote });
  } catch (err: any) {
    log("Quote Error:", err);
    return res.status(500).json({ error: "Quote fetch failed", details: err.message });
  }
});

export { router as iciciBrokerRouter };
