// backend/src/routes/icici/marketData.ts
import { Router } from "express";
import { authenticateToken, AuthRequest } from "../../middleware/auth.js";
import { query } from "../../config/database.js";
import { getBreezeInstance } from "../../utils/breezeSession.js";

const router = Router();

/**
 * @route GET /api/icici/marketData/subscribe/:symbol
 * @desc Subscribe to a live market feed and store ticks in Postgres
 */
router.get("/subscribe/:symbol", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { symbol } = req.params;

    // Create a Breeze instance for this user (with their saved ICICI credentials)
    const breeze = await getBreezeInstance(userId);

    // Ensure websocket is connected
    if (typeof breeze.wsConnect === "function") {
      await breeze.wsConnect();
      console.log(`📡 Connected to Breeze WebSocket for ${symbol}`);
    } else {
      console.warn("⚠️ breeze.wsConnect not available on Breeze instance");
    }

    // On receiving live ticks — matching Breeze SDK callback shape
    // breeze.onTicks = (tick) => { ... } OR breeze.on = (event, cb) depending on SDK version.
    // We'll support both common patterns: set onTicks or on('ticks')
    const handleTick = async (tick: any) => {
      try {
        const data = tick.data || tick;
        await query(
          `INSERT INTO market_ticks 
            (symbol, exchange, last_price, open, high, low, volume, timestamp)
           VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())`,
          [
            (data.stock_code || data.symbol || "").toString().toUpperCase(),
            data.exchange_code || "NSE",
            data.ltp ?? data.last_price ?? null,
            data.open ?? null,
            data.high ?? null,
            data.low ?? null,
            data.ttq ?? data.volume ?? null,
          ]
        );
      } catch (dbErr) {
        console.error("❌ Tick insert error:", dbErr);
      }
    };

    // Attach tick handlers based on SDK
    if (typeof breeze.onTicks === "function") {
      breeze.onTicks = handleTick;
    } else if (typeof breeze.on === "function") {
      // some SDK versions use breeze.on("ticks", callback)
      breeze.on("ticks", handleTick);
      // also try generic 'on' fallback for order/other events
      breeze.on("order_update", (ev: any) => {
        // noop for now; could store order updates if needed
        console.log("order_update", ev);
      });
    } else {
      console.warn("⚠️ Breeze SDK does not expose onTicks or on(event,..). Live ticks may not be delivered.");
    }

    // Subscribe to live feed
    await breeze.subscribeFeeds({
      exchangeCode: "NSE",
      stockCode: symbol.toUpperCase(),
      getExchangeQuotes: true,
      getMarketDepth: false,
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
 * @route GET /api/icici/marketData/quotes/:symbol
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

export default router;
