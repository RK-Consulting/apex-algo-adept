// src/routes/iciciBacktest.ts
import { Router } from "express";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { query } from "../config/database.js";
import { BreezeConnect } from "breezeconnect";

const router = Router();

/**
 * Helper — Initialize Breeze instance using stored user credentials
 */
async function getBreezeInstance(userId: string): Promise<BreezeConnect> {
  const { rows } = await query(
    `SELECT icici_api_key, icici_api_secret, icici_session_token
     FROM user_credentials WHERE user_id = $1`,
    [userId]
  );

  if (rows.length === 0) {
    throw new Error("Missing ICICI credentials.");
  }

  const { icici_api_key, icici_api_secret } = rows[0];

  if (!icici_api_key || !icici_api_secret) {
    throw new Error("Incomplete ICICI credentials. Please re-connect.");
  }

  const breeze = new BreezeConnect();
  breeze.setApiKey(icici_api_key);
  await breeze.generateSession(icici_api_secret); // Only 1 arg

  return breeze;
}

/**
 * POST /api/icici/backtest
 * Run backtest using historical OHLC data from Breeze
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
    } = req.body;

    if (!strategyId || !symbol) {
      return res.status(400).json({ error: "strategyId and symbol are required" });
    }

    // Fetch strategy config
    const { rows: stratRows } = await query(
      `SELECT strategy_config FROM strategies WHERE id = $1 AND user_id = $2`,
      [strategyId, userId]
    );

    if (stratRows.length === 0) {
      return res.status(404).json({ error: "Strategy not found" });
    }

    const strategy = stratRows[0].strategy_config;
    const breeze = await getBreezeInstance(userId);

    // Correct method name: getHistoricalDataV2
    const ohlcResponse = await breeze.getHistoricalDataV2({
      interval: "1day",
      fromDate,
      toDate,
      stockCode: symbol,
      exchangeCode: exchange,
      productType: "cash",
    });

    const candles = ohlcResponse?.Success || ohlcResponse?.success || ohlcResponse?.data || [];

    if (!Array.isArray(candles) || candles.length === 0) {
      return res.status(400).json({ error: "No OHLC data returned from Breeze API" });
    }

    // Backtest logic
    let positionOpen = false;
    let entryPrice = 0;
    let pnl = 0;
    let trades = 0;
    let wins = 0;

    const stopLossPct = strategy?.risk_management?.stop_loss || 1.5;
    const takeProfitPct = strategy?.risk_management?.take_profit || 3.0;

    for (const candle of candles) {
      const close = parseFloat(candle.close || candle.Close || "0");
      const high = parseFloat(candle.high || candle.High || "0");
      const low = parseFloat(candle.low || candle.Low || "0");

      if (isNaN(close) || isNaN(high) || isNaN(low)) continue;

      if (!positionOpen) {
        // Simple entry: 40% chance (replace with real signal later)
        if (Math.random() > 0.6) {
          positionOpen = true;
          entryPrice = close;
          trades++;
        }
      } else {
        const gain = ((high - entryPrice) / entryPrice) * 100;
        const loss = ((entryPrice - low) / entryPrice) * 100;

        if (gain >= takeProfitPct) {
          pnl += (takeProfitPct / 100) * entryPrice;
          wins++;
          positionOpen = false;
        } else if (loss >= stopLossPct) {
          pnl -= (stopLossPct / 100) * entryPrice;
          positionOpen = false;
        }
      }
    }

    // Safe string conversion
    const winRateStr = trades > 0 ? ((wins / trades) * 100).toFixed(2) : "0";
    const avgPnLStr = trades > 0 ? (pnl / trades).toFixed(2) : "0";

    const performance = {
      total_trades: trades,
      win_rate: parseFloat(winRateStr),        // string → number
      total_pnl: parseFloat(pnl.toFixed(2)),
      avg_pnl_per_trade: parseFloat(avgPnLStr), // string → number
      test_period: { fromDate, toDate },
    };

    // Save to DB
    await query(
      `UPDATE strategies
       SET performance_data = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3`,
      [JSON.stringify(performance), strategyId, userId]
    );

    res.json({
      success: true,
      backtest: {
        trades,
        wins,
        winRate: winRateStr,
        pnl: pnl.toFixed(2),
        avgPnL: avgPnLStr,
        strategy,
      },
    });
  } catch (err: any) {
    console.error("Backtest Error:", err.message || err);
    next(err);
  }
});

export { router as iciciBacktestRouter };
