import { Router } from "express";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { query } from "../config/database.js";
import { BreezeConnect } from "breezeconnect";

const router = Router();

/**
 * Helper — Initialize Breeze Instance with stored credentials
 */
async function getBreezeInstance(userId: string) {
  const { rows } = await query(
    `SELECT icici_api_key, icici_api_secret, icici_session_token
     FROM user_credentials WHERE user_id = $1`,
    [userId]
  );

  if (rows.length === 0) throw new Error("Missing ICICI credentials.");
  const { icici_api_key, icici_api_secret, icici_session_token } = rows[0];
  if (!icici_api_key || !icici_api_secret || !icici_session_token)
    throw new Error("Incomplete ICICI credentials. Please re-connect.");

  const breeze = new BreezeConnect({ appKey: icici_api_key });
  await breeze.generateSession(icici_api_secret, icici_session_token);
  return breeze;
}

/**
 * @route POST /api/icici/backtest
 * @desc Run backtest on stored strategy using Breeze OHLC data
 */
router.post("/backtest", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const { strategyId, symbol, exchange = "NSE", fromDate, toDate } = req.body;

    if (!strategyId || !symbol) {
      return res.status(400).json({ error: "strategyId and symbol are required" });
    }

    // ✅ Fetch strategy configuration from DB
    const { rows: stratRows } = await query(
      `SELECT strategy_config FROM strategies WHERE id = $1 AND user_id = $2`,
      [strategyId, userId]
    );

    if (stratRows.length === 0) {
      return res.status(404).json({ error: "Strategy not found" });
    }

    const strategy = stratRows[0].strategy_config;
    const breeze = await getBreezeInstance(userId);

    // ✅ Fetch historical OHLC data from Breeze API
    const ohlcData = await breeze.getHistoricalDatav2({
      interval: "1day",
      fromDate: fromDate || "2025-01-01T07:00:00.000Z",
      toDate: toDate || new Date().toISOString(),
      stockCode: symbol,
      exchangeCode: exchange,
      productType: "cash",
    });

    const candles = ohlcData?.Success || ohlcData?.success || ohlcData?.data || [];

    if (!candles || candles.length === 0) {
      return res.status(400).json({ error: "No OHLC data returned from Breeze API" });
    }

    // ✅ Basic Backtesting Engine
    let positionOpen = false;
    let entryPrice = 0;
    let pnl = 0;
    let trades = 0;
    let wins = 0;

    // Example: Use strategy rules (you can expand later)
    const stopLoss = strategy?.risk_management?.stop_loss || 1.5; // %
    const takeProfit = strategy?.risk_management?.take_profit || 3.0; // %

    for (const candle of candles) {
      const close = parseFloat(candle.close);
      const high = parseFloat(candle.high);
      const low = parseFloat(candle.low);

      if (!positionOpen) {
        // Example entry rule: random / RSI-based can be added later
        if (Math.random() > 0.6) {
          positionOpen = true;
          entryPrice = close;
          trades++;
        }
      } else {
        const gain = ((high - entryPrice) / entryPrice) * 100;
        const loss = ((entryPrice - low) / entryPrice) * 100;

        if (gain >= takeProfit) {
          pnl += (takeProfit / 100) * entryPrice;
          wins++;
          positionOpen = false;
        } else if (loss >= stopLoss) {
          pnl -= (stopLoss / 100) * entryPrice;
          positionOpen = false;
        }
      }
    }

    const winRate = trades ? ((wins / trades) * 100).toFixed(2) : 0;
    const avgPnL = trades ? (pnl / trades).toFixed(2) : 0;

    // ✅ Save results to DB
    await query(
      `UPDATE strategies
       SET performance_data = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3`,
      [
        JSON.stringify({
          total_trades: trades,
          win_rate: parseFloat(winRate),
          total_pnl: parseFloat(pnl.toFixed(2)),
          avg_pnl_per_trade: parseFloat(avgPnL),
          test_period: { fromDate, toDate },
        }),
        strategyId,
        userId,
      ]
    );

    res.json({
      success: true,
      backtest: {
        trades,
        wins,
        winRate,
        pnl: pnl.toFixed(2),
        avgPnL,
        strategy,
      },
    });
  } catch (err) {
    console.error("❌ Backtest Error:", err);
    next(err);
  }
});

export { router as iciciBacktestRouter };
