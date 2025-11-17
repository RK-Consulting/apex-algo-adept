// src/routes/icici/marketData.ts
import { Router } from "express";
import { authenticateToken, AuthRequest } from "../../middleware/auth.js";
import { getBreezeInstance } from "../../utils/breezeSession.js";
import { mapSymbolForBreeze } from "../../utils/symbolMapper.js";
import debug from "debug";

const router = Router();
const log = debug("apex:icici:market");

/**
 * GET /api/icici/market/ltp?symbol=RELIANCE&exchange=NSE
 */
router.get("/ltp", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const symbol = req.query.symbol as string;
    const exchange = (req.query.exchange as string) || "NSE";

    if (!symbol)
      return res.status(400).json({ error: "symbol is required" });

    const mapped = mapSymbolForBreeze(symbol);
    const breeze = await getBreezeInstance(req.user!.id);

    const data = await breeze.getLtp({
      stockCode: mapped.payload,
      exchangeCode: exchange,
    });

    return res.json({ success: true, ltp: data });
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
 * { symbol, exchange, interval, fromDate, toDate }
 */
router.post("/ohlc", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { symbol, exchange = "NSE", interval = "1day", fromDate, toDate } =
      req.body;

    if (!symbol)
      return res.status(400).json({ error: "symbol is required" });

    const mapped = mapSymbolForBreeze(symbol);
    const breeze = await getBreezeInstance(req.user!.id);

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
 * GET /api/icici/market/quote?symbol=RELIANCE&exchange=NSE
 */
router.get("/quote", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const symbol = req.query.symbol as string;
    const exchange = (req.query.exchange as string) || "NSE";

    if (!symbol)
      return res.status(400).json({ error: "symbol is required" });

    const mapped = mapSymbolForBreeze(symbol);
    const breeze = await getBreezeInstance(req.user!.id);

    const quote = await breeze.getQuote({
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

export { router as marketDataRouter };
