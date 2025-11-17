// src/routes/icici/marketData.ts
import { Router } from "express";
import { authenticateToken, AuthRequest } from "../../middleware/auth.js";
import { query } from "../../config/database.js";
import { getBreezeInstance } from "../../utils/breezeSession.js";
import { mapSymbolForBreeze } from "../../utils/symbolMapper.js";
import debug from "debug";

const router = Router();
const log = debug("apex:icici:market");

/**
 * SUBSCRIBE TO ICICI LIVE MARKET FEED
 * -----------------------------------
 * This version:
 *  - Uses updated Breeze SDK
 *  - Correctly handles index vs stock tokens
 *  - Stores ticks safely
 *  - Avoids deprecated .connect()
 *  - Supports only valid subscribeFeeds() format
 */
router.get("/subscribe/:symbol", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { symbol } = req.params;

    if (!symbol) {
      return res.status(400).json({ error: "Symbol is required" });
    }

    const mapped = mapSymbolForBreeze(symbol);
    const breeze = await getBreezeInstance(userId);

    // --- HANDLE TICK EVENTS ---
    const handleTick = async (tick: any) => {
      try {
        const d = tick?.data || tick;

        const stockCode =
          (d.stock_code || d.symbol || mapped.payload || symbol).toString().toUpperCase();

        await query(
          `INSERT INTO market_ticks
            (symbol, exchange, last_price, open, high, low, volume, timestamp)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
          [
            stockCode,
            d.exchange_code || "NSE",
            d.ltp ?? d.last_price ?? null,
            d.open ?? null,
            d.high ?? null,
            d.low ?? null,
            d.ttq ?? d.volume ?? null,
          ]
        );
      } catch (dbErr: any) {
        log("Tick insert error:", dbErr.message || dbErr);
      }
    };

    // SUBSCRIBE TO FEEDS
    // Breeze V2 uses subscribeFeeds(), no connect() required.
    breeze.on?.("message", handleTick);

    const feedArgs =
      mapped.type === "index"
        ? {
            stockCode: mapped.payload, // EX: "NIFTY 50"
            exchangeCode: "NSE",
          }
        : {
            stockCode: mapped.payload, // EX: "RELIANCE"
            exchangeCode: "NSE",
            productType: "cash",
          };

    await breeze.subscribeFeeds(feedArgs);

    log(`📡 Subscribed to live feed for ${mapped.payload}`);

    return res.json({
      success: true,
      message: `Subscribed to live feed for ${mapped.payload}`,
    });
  } catch (err: any) {
    log("Market Subscribe Error:", err.message || err);
    res.status(500).json({ error: "Failed to subscribe to market feed" });
  }
});

/**
 * GET LIVE QUOTES (STOCK / INDEX)
 * --------------------------------
 * Uses updated mapping + correct API
 */
router.get("/quotes/:symbol", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { symbol } = req.params;

    if (!symbol) {
      return res.status(400).json({ error: "Symbol is required" });
    }

    const mapped = mapSymbolForBreeze(symbol);
    const breeze = await getBreezeInstance(userId);

    let resp;

    // For indices — try index API if supported
    if (mapped.type === "index") {
      if (typeof (breeze as any).getIndexQuotes === "function") {
        resp = await (breeze as any).getIndexQuotes({ index: mapped.payload });
      } else {
        resp = await breeze.getQuotes({
          stockCode: mapped.payload,
          exchangeCode: "NSE",
          productType: "cash",
        });
      }
    } else {
      // equities
      resp = await breeze.getQuotes({
        stockCode: mapped.payload,
        exchangeCode: "NSE",
        productType: "cash",
      });
    }

    res.json({ success: true, data: resp });
  } catch (err: any) {
    console.error("Quote Fetch Error:", err.message || err);
    res.status(500).json({ error: "Failed to fetch quote" });
  }
});

export default router;
