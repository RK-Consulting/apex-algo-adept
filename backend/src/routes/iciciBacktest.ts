// src/routes/iciciBacktest.ts
import { Router } from "express";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { query } from "../config/database.js";
import { getBreezeInstance } from "../utils/breezeSession.js";
import { mapSymbolForBreeze } from "../utils/symbolMapper.js";
import debug from "debug";

const router = Router();
const log = debug("apex:icici:backtest");

/**
 * POST /api/icici/backtest
 * Run backtest using Breeze historical OHLC
 */
router.post("/backtest", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const {
      strategyId,
      symbol,
      exchange = "NSE",
      fromDate = "2025-01-01T07:00:00.000Z",
      toDate = new Date().toISOString(),
      interval = "1day",
    } = req.body;

    if (!strategyId || !symbol) {
      return res.status(400).json({ error: "strategyId and symbol are required" });
    }

    // Load strategy
    const { rows: stratRows } = await query(
      `SELECT strategy_config FROM strategies WHERE id = $1 AND user_id = $2`,
      [strategyId, userId]
    );

    if (stratRows.length === 0) {
      return res.status(404).json({ error: "Strategy not found" });
    }

    const strategy = stratRows[0].strategy_config;

    // Symbol mapping (NIFTY, BANKNIFTY, stocks)
    const mapped = mapSymbolForBreeze(symbol);

    const breeze = await getBreezeInstance(userId);

    // Fetch OHLC from ICICI
    const ohlcResponse = await breeze.getHistoricalDataV2({
      interval,
      fromDate,
      toDate,
      stockCode: mapped.payload,
      exchangeCode: exchange,
      productType: "cash",
    });

    // Support all possible response structures
    const candles =
      ohlcResponse?.Success ||
      ohlcResponse?.success ||
      ohlcResponse?.data ||
      [];

    if (!Array.isArray(candles) || candles.length === 0) {
      return res.status(400).json({ error: "No OHLC data returned from Breeze API" });
    }

    log(`📊 Retrieved ${candles.length} candles for ${mapped.payload}`);

    // BACKTEST ENGINE
    let positionOpen = false;
    let entryPrice = 0;
    let pnl = 0;
    let trades = 0;
    let wins = 0;

    const stopLossPct = strategy?.risk_management?.stop_loss ?? 1.5;
    const takeProfitPct = strategy?.risk_management?.take_profit ?? 3.0;

    for (const candle of candles) {
      // Normalize fields (Breeze sometimes uses uppercase)
      const close = parseFloat(candle.close ?? candle.Close ?? "0");
      const high = parseFloat(candle.high ?? candle.High ?? "0");
      const low = parseFloat(candle.low ?? candle.Low ?? "0");

      if (isNaN(close) || isNaN(high) || isNaN(low)) continue;

      // Simple entry condition (placeholder)
      if (!positionOpen) {
        if (Math.random() > 0.6) {
          positionOpen = true;
          entryPrice = close;
          trades++;
        }
      } else {
        const gainPct = ((high - entryPrice) / entryPrice) * 100;
        const lossPct = ((entryPrice - low) / entryPrice) * 100;

        if (gainPct >= takeProfitPct) {
          pnl += (takeProfitPct / 100) * entryPrice;
          wins++;
          positionOpen = false;
        } else if (lossPct >= stopLossPct) {
          pnl -= (stopLossPct / 100) * entryPrice;
          positionOpen = false;
        }
      }
    }

    const winRate = trades > 0 ? (wins / trades) * 100 : 0;
    const avgPnL = trades > 0 ? pnl / trades : 0;

    const performance = {
      total_trades: trades,
      win_rate: parseFloat(winRate.toFixed(2)),
      total_pnl: parseFloat(pnl.toFixed(2)),
      avg_pnl_per_trade: parseFloat(avgPnL.toFixed(2)),
      test_period: { fromDate, toDate },
    };

    // Save performance results
    await query(
      `UPDATE strategies
       SET performance_data = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3`,
      [JSON.stringify(performance), strategyId, userId]
    );

    return res.json({
      success: true,
      backtest: {
        trades,
        wins,
        winRate: winRate.toFixed(2),
        pnl: pnl.toFixed(2),
        avgPnL: avgPnL.toFixed(2),
        strategy,
      },
    });
  } catch (err: any) {
    log("Backtest Error:", err);
    next(err);
  }
});

export { router as iciciBacktestRouter };
