import { Router } from "express";
import { query } from "../config/database.js";

const router = Router();

const BASE_PRICES: Record<string, number> = {
  RELIANCE: 2456.7,
  TCS: 3789.2,
  INFY: 1567.45,
  HDFCBANK: 1678.9,
  ICICIBANK: 987.35,
  NIFTY: 21453.25,
  SENSEX: 71283.45,
  BANKNIFTY: 46789.3,
  INDIAVIX: 12.45,
};

// 🔧 Utility: Generate simulated market data
async function generateMarketData(symbol: string, exchange: string) {
  const lastData = await query(
    `SELECT price, volume FROM market_data 
     WHERE symbol = $1 AND exchange = $2 
     ORDER BY timestamp DESC LIMIT 1`,
    [symbol, exchange]
  );

  const basePrice = lastData.rows[0]?.price || BASE_PRICES[symbol] || 1000;
  const changePercent = (Math.random() - 0.5) * 1.0;
  const change = (basePrice * changePercent) / 100;
  const newPrice = basePrice + change;

  const baseVolume =
    lastData.rows[0]?.volume || Math.floor(Math.random() * 5_000_000 + 1_000_000);
  const volumeChange = (Math.random() - 0.5) * 0.2;
  const newVolume = Math.floor(baseVolume * (1 + volumeChange));

  const openPrice = basePrice - (Math.random() - 0.5) * basePrice * 0.01;
  const highPrice = Math.max(newPrice, openPrice) + Math.random() * basePrice * 0.005;
  const lowPrice = Math.min(newPrice, openPrice) - Math.random() * basePrice * 0.005;

  return {
    symbol,
    exchange,
    price: parseFloat(newPrice.toFixed(2)),
    change: parseFloat(change.toFixed(2)),
    change_percent: parseFloat(changePercent.toFixed(2)),
    volume: newVolume,
    open: parseFloat(openPrice.toFixed(2)),
    high: parseFloat(highPrice.toFixed(2)),
    low: parseFloat(lowPrice.toFixed(2)),
    previous_close: parseFloat(basePrice.toFixed(2)),
    additional_data: {
      market_cap: Math.floor(Math.random() * 1_000_000_000_000),
      pe_ratio: parseFloat((Math.random() * 30 + 10).toFixed(2)),
      sector: ["Technology", "Banking", "Energy", "FMCG", "Auto"][
        Math.floor(Math.random() * 5)
      ],
    },
  };
}

// 🔹 Stream simulated data for requested symbols
router.post("/stream", async (req, res, next) => {
  try {
    const { symbols } = req.body;

    if (!Array.isArray(symbols) || symbols.length === 0) {
      return res.status(400).json({ error: "Symbols array required" });
    }

    const marketDataArray = await Promise.all(
      symbols.map((s: { symbol: string; exchange: string }) =>
        generateMarketData(s.symbol, s.exchange)
      )
    );

    for (const data of marketDataArray) {
      await query(
        `INSERT INTO market_data (
          symbol, exchange, price, change, change_percent, volume,
          open, high, low, previous_close, additional_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          data.symbol,
          data.exchange,
          data.price,
          data.change,
          data.change_percent,
          data.volume,
          data.open,
          data.high,
          data.low,
          data.previous_close,
          JSON.stringify(data.additional_data),
        ]
      );
    }

    res.json({
      success: true,
      data: marketDataArray,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// 🔹 Fetch historical data for a symbol
router.get("/history/:symbol", async (req, res, next) => {
  try {
    const { symbol } = req.params;
    const { exchange = "NSE", limit = 100 } = req.query;

    const result = await query(
      `SELECT * FROM market_data 
       WHERE symbol = $1 AND exchange = $2 
       ORDER BY timestamp DESC 
       LIMIT $3`,
      [symbol, exchange, limit]
    );

    res.json({ success: true, rows: result.rows });
  } catch (error) {
    next(error);
  }
});

export { router as marketDataRouter };
