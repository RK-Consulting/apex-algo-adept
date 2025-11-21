// src/routes/icici/marketData.ts
import { Router } from "express";
import { authenticateToken, AuthRequest } from "../../middleware/auth.js";
import { getBreezeInstance } from "../../utils/breezeSession.js";
import { mapSymbolForBreeze } from "../../utils/symbolMapper.js";
import debug from "debug";

const router = Router();
const log = debug("apex:icici:market");

/**
 * GET /api/icici/market/ltp
 */
router.get("/ltp", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const symbol = req.query.symbol as string;
    const exchange = (req.query.exchange as string) || "NSE";

    if (!symbol)
      return res.status(400).json({ error: "symbol is required" });

    const mapped = mapSymbolForBreeze(symbol);

    const breeze = await getBreezeInstance(req.user!.userId);

    const quote = await breeze.getQuotes({
      stockCode: mapped.payload,
      exchangeCode: exchange,
    });

    return res.json({ success: true, ltp: quote });
  } catch (err: any) {
    log("LTP error:", err);
    return res.status(500).json({
      error: "Failed to get LTP",
      details: err?.message || err,
    });
  }
});

/**
 * POST /api/icici/market/ohlc
 */
router.post("/ohlc", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { symbol, exchange = "NSE", interval = "1day", fromDate, toDate } =
      req.body;

    if (!symbol)
      return res.status(400).json({ error: "symbol is required" });

    const mapped = mapSymbolForBreeze(symbol);
    const breeze = await getBreezeInstance(req.user!.userId);

    const ohlc = await breeze.getHistoricalDataV2({
      interval,
      fromDate,
      toDate,
      stockCode: mapped.payload,
      exchangeCode: exchange,
      productType: "cash",
    });

    return res.json({ success: true, ohlc });
  } catch (err: any) {
    log("OHLC error:", err);
    return res.status(500).json({
      error: "Failed to load OHLC",
      details: err?.message || err,
    });
  }
});

/**
 * GET /api/icici/market/quote
 */
router.get("/quote", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const symbol = req.query.symbol as string;
    const exchange = (req.query.exchange as string) || "NSE";

    if (!symbol)
      return res.status(400).json({ error: "symbol is required" });

    const mapped = mapSymbolForBreeze(symbol);
    const breeze = await getBreezeInstance(req.user!.userId);

    const quote = await breeze.getQuotes({
      stockCode: mapped.payload,
      exchangeCode: exchange,
    });

    return res.json({ success: true, quote });
  } catch (err: any) {
    log("Quote error:", err);
    return res.status(500).json({
      error: "Failed to load quote",
      details: err?.message || err,
    });
  }
});

/* --------------------------------------------------------------------------
   NEW ENDPOINT (REQUIRED BY WATCHLIST PRO)
   POST /api/icici/market/quotes-bulk
   Body: { symbols: ["RELIANCE", "TCS", ...] }
-------------------------------------------------------------------------- */

router.post("/quotes-bulk", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { symbols, exchange = "NSE" } = req.body;

    if (!Array.isArray(symbols) || symbols.length === 0) {
      return res.status(400).json({ error: "symbols[] required" });
    }

    const breeze = await getBreezeInstance(req.user!.userId);

    const results = {};

    for (const symbol of symbols) {
      try {
        const mapped = mapSymbolForBreeze(symbol);

        const q = await breeze.getQuotes({
          stockCode: mapped.payload,
          exchangeCode: exchange,
        });

        results[symbol] = q?.Success?.[0] || null;
      } catch (e) {
        results[symbol] = null;
      }
    }

    return res.json({
      success: true,
      ticks: results,  // required by frontend Watchlist Pro
    });

  } catch (err: any) {
    log("Bulk quotes error:", err);
    return res.status(500).json({
      error: "Bulk quote fetch failed",
      details: err?.message || err,
    });
  }
});


export { router as marketDataRouter };
