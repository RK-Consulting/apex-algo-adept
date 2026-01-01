// backend/src/routes/icici/authLogin.ts

/**
 * ICICI OAuth Login Initiator
 *
 * Responsibility:
 * - Authenticated initiation of ICICI login
 * - Fetches ONLY app_key from broker_credentials
 * - Performs SERVER-SIDE redirect to ICICI
 *
 * Naming Discipline:
 * - DB layer     → app_key
 * - Server layer → serverAppKey
 */

import { Router } from "express";
import { authenticateToken, AuthRequest } from "../../middleware/auth.js";
import { iciciGuard } from "../../middleware/iciciGuard.js";
import { query } from "../../config/database.js";
import debug from "debug";

const log = debug("alphaforge:icici:login");
const router = Router();

/**
 * POST /api/icici/auth/login
 * Returns ICICI redirect URL
 */
/* router.post(
  "/login",
  authenticateToken,
  //iciciGuard("LOGIN"),
  async (req: AuthRequest, res) => {
    const userId = req.user!.userId;

    const dbResult = await query(
      `
      SELECT app_key
      FROM broker_credentials
      WHERE user_id = $1
        AND broker_name = 'ICICI'
        AND is_active = true
      `,
      [userId]
    );

    if (dbResult.rowCount === 0) {
      return res.status(400).json({
        error: "ICICI API key not configured",
      });
    }

    const redirectUrl =
      "https://api.icicidirect.com/apiuser/login?api_key=" +
      encodeURIComponent(dbResult.rows[0].app_key);

    log("ICICI login initiated for user %s", userId);

    return res.json({ redirectUrl });
  }
); */

// backend/src/routes/icici/authLogin.ts
router.get(  // ← GET, not POST
  "/login",
  authenticateToken,  // ← Will read token from query param
  async (req: AuthRequest, res) => {
    const userId = req.user!.userId;

    // Insert login attempt
    await query(
      `INSERT INTO icici_login_attempts (user_id, state, updated_at)
       VALUES ($1, 'LOGIN_INITIATED', NOW())
       ON CONFLICT (user_id) DO UPDATE 
       SET state = 'LOGIN_INITIATED', updated_at = NOW()`,
      [userId]
    );

    // Get API key
    const dbResult = await query(
      `SELECT app_key FROM broker_credentials
       WHERE user_id = $1 AND broker_name = 'ICICI' AND is_active = true`,
      [userId]
    );

    if (dbResult.rowCount === 0) {
      return res.status(400).send("ICICI credentials not configured");
    }

    // Redirect directly to ICICI
    const iciciUrl = `https://api.icicidirect.com/apiuser/login?api_key=${encodeURIComponent(dbResult.rows[0].app_key)}`;
    return res.redirect(iciciUrl);
  }
);

export default router;
export const iciciAuthLoginRouter = router;

