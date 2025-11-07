// src/routes/icici/marketData.ts
import { Router } from "express";
import { authenticateToken, AuthRequest } from "../../middleware/auth.js";
import { query } from "../../config/database.js";
import { getBreezeInstance } from "../../utils/breezeSession.js";

const router = Router();

/**
 * GET /api/icici/marketData/subscribe/:symbol
 * Subscribe to live market feed and store ticks in DB
 */
router.get("/subscribe/:symbol", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { symbol } = req.params;

    if (!symbol) {
      return res.status(400).json({ error: "Symbol is required" });
    }

    const breeze = await getBreezeInstance(userId);

    // Connect WebSocket
    if (typeof breeze.connect === "function") {
      breeze.connect();
      console.log(`Connected to Breeze WebSocket for ${symbol}`);
    }

    // Handle incoming ticks
    const handleTick = async (tick: any) => {
      try {
        const data = tick.data || tick;
        await query(
          `INSERT INTO market_ticks
            (symbol, exchange, last_price, open, high, low, volume, timestamp)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
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
      } catch (dbErr: any) {
        console.error("Tick insert error:", dbErr.message || dbErr);
      }
    };

    // Use event emitter: breeze.on('message', ...)
    if (typeof breeze.on === "function") {
      breeze.on("message", handleTick);
      console.log(`Subscribed to ticks for ${symbol}`);
    } else {
      console.warn("Breeze SDK does not support .on() — live ticks disabled");
    }

    // Subscribe to feed
    breeze.subscribeFeeds({
      stockCode: symbol.toUpperCase(),
      exchangeCode: "NSE",
      productType: "cash",
    });

    res.json({
      success: true,
      message: `Subscribed to live feed for ${symbol.toUpperCase()}`,
    });
  } catch (err: any) {
    console.error("Market Subscribe Error:", err.message || err);
    res.status(500).json({ error: "Failed to subscribe to market feed" });
  }
});

/**
 * GET /api/icici/marketData/quotes/:symbol
 * Fetch current quote
 */
router.get("/quotes/:symbol", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { symbol } = req.params;

    if (!symbol) {
      return res.status(400).json({ error: "Symbol is required" });
    }

    const breeze = await getBreezeInstance(userId);
    const resp = await breeze.getQuotes({
      stockCode: symbol.toUpperCase(),
      exchangeCode: "NSE",
      productType: "cash",
    });

    res.json({ success: true, data: resp });
  } catch (err: any) {
    console.error("Quote Fetch Error:", err.message || err);
    res.status(500).json({ error: "Failed to fetch quote" });
  }
});

export default router;
