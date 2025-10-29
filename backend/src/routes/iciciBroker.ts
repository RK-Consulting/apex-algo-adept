import { Router } from "express";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { query } from "../config/database.js";
import { BreezeConnect } from "breezeconnect";

const router = Router();

/**
 * @route POST /api/icici/login
 * @desc Authenticate and store ICICI Direct Breeze credentials
 */
router.post("/login", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { apiKey, apiSecret } = req.body;

    if (!apiKey || !apiSecret) {
      return res.status(400).json({ error: "Missing ICICI API credentials" });
    }

    const breeze = new BreezeConnect();

    // ✅ Correct SDK usage
    const sessionResponse = await breeze.generateSession(apiKey, apiSecret);

    const token =
      sessionResponse?.data?.session_token || sessionResponse?.session_token;

    if (!token) {
      return res.status(400).json({
        error: "Failed to retrieve session token from ICICI Direct",
        response: sessionResponse,
      });
    }

    // Store in DB
    await query(
      `UPDATE user_credentials 
       SET icici_api_key = $1, icici_api_secret = $2, icici_token = $3 
       WHERE user_id = $4`,
      [apiKey, apiSecret, token, req.user!.id]
    );

    res.json({
      success: true,
      message: "ICICI Breeze login successful",
      token,
    });
  } catch (error) {
    console.error("❌ ICICI Breeze Login Error:", error);
    next(error);
  }
});

/**
 * @route GET /api/icici/portfolio
 * @desc Fetch user’s portfolio holdings from ICICI Direct Breeze
 */
router.get("/portfolio", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const creds = await query(
      `SELECT icici_api_key, icici_api_secret, icici_token 
       FROM user_credentials WHERE user_id = $1`,
      [userId]
    );

    if (creds.rows.length === 0) {
      return res.status(404).json({ error: "No ICICI credentials found" });
    }

    const { icici_api_key, icici_api_secret, icici_token } = creds.rows[0];

    const breeze = new BreezeConnect();
    await breeze.generateSession(icici_api_key, icici_api_secret);
    breeze.setToken(icici_token);

    const portfolio = await breeze.getPortfolioHoldings();

    res.json({
      success: true,
      portfolio,
    });
  } catch (error) {
    console.error("❌ ICICI Portfolio Fetch Error:", error);
    next(error);
  }
});

export { router as iciciBrokerRouter };
