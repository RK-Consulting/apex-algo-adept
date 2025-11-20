// backend/src/routes/icici/status.ts
import { Router } from "express";
import { authenticateToken, AuthRequest } from "../../middleware/auth.js";
import { getBreezeInstance } from "../../utils/breezeSession.js";
import { query } from "../../config/database.js";
import debug from "debug";

const log = debug("apex:icici:status");
const router = Router();

/**
 * GET /api/icici/status
 * Shows broker connection status + credential meta
 */
router.get("/status", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    // Fetch encrypted meta data only (not decrypting here)
    const meta = await query(
      `SELECT updated_at, icici_api_key IS NOT NULL AS hasKey
       FROM user_credentials
       WHERE user_id = $1`,
      [userId]
    );

    if (!meta.rows.length) {
      return res.json({
        success: true,
        connected: false,
        has_credentials: false,
        message: "ICICI credentials not stored"
      });
    }

    const hasKey = meta.rows[0].haskey;

    if (!hasKey) {
      return res.json({
        success: true,
        connected: false,
        has_credentials: false,
        message: "ICICI credentials missing"
      });
    }

    // Validate real Breeze session
    let connected = false;
    try {
      const breeze = await getBreezeInstance(userId);
      await breeze.getFunds();
      connected = true;
    } catch (err) {
      connected = false;
    }

    return res.json({
      success: true,
      connected,
      has_credentials: true,
      last_updated: meta.rows[0].updated_at,
    });
  } catch (err: any) {
    log("Status error:", err);
    return res.status(500).json({
      success: false,
      connected: false,
      error: err.message || "Failed to fetch ICICI status"
    });
  }
});

export { router as iciciStatusRouter };
