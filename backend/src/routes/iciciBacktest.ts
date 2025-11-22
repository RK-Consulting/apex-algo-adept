/**
 * ************************************************************
 *  ICICI BACKTEST ROUTER
 *  -----------------------------------------------------------
 *  Purpose:
 *    • Provide safe placeholder API for running strategy backtests.
 *    • Can be later integrated with ICICI Historical Data API.
 *    • Ensures the frontend expecting /api/icici/backtest continues to work.
 *
 *  Routes:
 *    POST /api/icici/backtest/run
 * ************************************************************
 */

import { Router } from "express";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";

export const iciciBacktestRouter = Router();

/**
 * -----------------------------------------------------------
 *  POST /api/icici/backtest/run
 *  Runs a mock backtest with dummy PnL output.
 *  Expand this later with ICICI historical APIs.
 * -----------------------------------------------------------
 */
iciciBacktestRouter.post("/run", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { strategyName, symbol, startDate, endDate } = req.body;

    // Minimal validation
    if (!symbol || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: "symbol, startDate, endDate are required",
      });
    }

    // Dummy mock calculation (replace with real logic later)
    const mockResult = {
      strategy: strategyName || "Unnamed Strategy",
      symbol,
      period: { startDate, endDate },
      userId,
      trades: 12,
      winRate: "58%",
      profit: 12750.5,
      maxDrawdown: "-4.3%",
      equityCurve: [
        { date: startDate, value: 100000 },
        { date: endDate, value: 112750.5 },
      ],
    };

    return res.json({
      success: true,
      message: "Backtest executed",
      result: mockResult,
    });
  } catch (err: any) {
    console.error("ICICI Backtest Error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to run backtest",
    });
  }
});
