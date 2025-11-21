// backend/src/routes/ai.ts
import { Router } from "express";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import debug from "debug";

const log = debug("apex:ai");
const router = Router();

/**
 * GET /api/ai/watchlist-suggestions
 * Optional: reads user preferences and returns top suggestions
 */
router.get("/watchlist-suggestions", authenticateToken, async (req: AuthRequest, res) => {
  // This is a lightweight heuristic placeholder.
  // Replace with real AI model or external service.
  const suggestions = [
    { name: "Volatility Arb", symbol: "NIFTY", description: "Volatility pairs", score: 0.9 },
    { name: "Momentum", symbol: "RELIANCE", description: "Recent 5-day momentum", score: 0.78 },
    { name: "Banking Focus", symbol: "ICICIBANK", description: "High liquidity", score: 0.6 },
  ];

  res.json({ success: true, suggestions });
});

export { router as aiRouter };
