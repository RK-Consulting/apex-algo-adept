// backend/src/routes/icici/authLogin.ts

import { Router } from "express";
import { authenticateToken, AuthRequest } from "../../middleware/auth.js";
import { query } from "../../config/database.js";
import debug from "debug";

const log = debug("alphaforge:icici:login");
const router = Router();

/**
 * GET /api/icici/auth/login
 * Initiates ICICI Breeze OAuth login
 */
router.get("/auth/login", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    // Fetch API key directly from DB (SessionService must NOT expose credentials)
    const result = await query(
      `
      SELECT api_key
      FROM icici_credentials
      WHERE user_id = $1
      `,
      [userId]
    );

    if (result.rowCount === 0 || !result.rows[0].api_key) {
      return res.status(400).json({
        success: false,
        error: "ICICI API key not configured for user",
      });
    }

    const { api_key } = result.rows[0];

    const loginUrl =
      `https://api.icicidirect.com/apiuser/login?api_key=` +
      encodeURIComponent(api_key);

    log("Redirecting user %s to ICICI login", userId);

    return res.redirect(loginUrl);
  } catch (err: any) {
    log("ICICI login init error: %s", err.message);
    return res.status(500).json({
      success: false,
      error: "Failed to initiate ICICI login",
    });
  }
});

export const iciciAuthLoginRouter = router;
