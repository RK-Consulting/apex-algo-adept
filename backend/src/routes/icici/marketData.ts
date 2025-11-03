import { Router } from "express";
import { authenticateToken, AuthRequest } from "../../middleware/auth.js";
import { query } from "../../config/database.js";
import { getBreezeInstance } from "../../utils/breezeSession.js";

const router = Router();

/**
 * @route GET /api/icici/market/subscribe
 * @desc Subscribe to a live market feed and store ticks in Postgres
 */
router.get("/subscribe/:symbol", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { symbol } = req.params;

    // Create a Breeze instance for this user (with their saved ICICI credentials)
    const breeze = await getBreezeInstance(userId);
    await breeze.wsConnect();

    console.log(`📡 Connected to Breeze WebSocket for ${symbol}`);

    // On receiving live ticks
    breeze.onTicks = async (tick: any) => {
      try {
        const data = tick.data || tick;
        await query(
          `INSERT INTO market_ticks 
            (symbol, exchange, last_price, open, high, low, volume, timestamp)
           VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())`,
          [
            data.stock_code || data.symbol,
            data.exchange_code || "NSE",
            data.ltp || data.last_price,
            data.open,
            data.high,
            data.low,
            data.ttq || data.volume,
          ]
        );
      } catch (dbErr) {
        console.error("❌ Tick insert error:", dbErr);
      }
    };

    // Subscribe to live feed
    await breeze.subscribeFeeds({
      exchangeCode: "NSE",
      stockCode: symbol.toUpperCase(),
    });

    res.json({
      success: true,
      message: `Subscribed to live feed for ${symbol.toUpperCase()}`,
    });
  } catch (err) {
    console.error("❌ Market Subscribe Error:", err);
    res.status(500).json({ error: "Failed to subscribe to market feed" });
  }
});

/**
 * @route GET /api/icici/market/quotes/:symbol
 * @desc Fetch current quote from Breeze API
 */
router.get("/quotes/:symbol", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { symbol } = req.params;

    const breeze = await getBreezeInstance(userId);

    const resp = await breeze.getQuotes({
      stockCode: symbol.toUpperCase(),
      exchangeCode: "NSE",
      productType: "cash",
    });

    res.json({ success: true, data: resp });
  } catch (err) {
    console.error("❌ Quote Fetch Error:", err);
    res.status(500).json({ error: "Failed to fetch quote" });
  }
});

export { router as marketRouter };
