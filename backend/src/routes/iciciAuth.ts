import { Router } from "express";
import debug from "debug";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { SessionService } from "../services/sessionService.js";
import pool from "../config/database.js";

const log = debug("apex:icici:auth");
const router = Router();

/**
 * ==========================================================
 * GET /api/icici/auth/login
 * ----------------------------------------------------------
 * Popup entrypoint.
 * - Uses JWT from HttpOnly cookie
 * - Fetches ICICI api_key from broker_credentials
 * - Redirects to ICICI Direct login page
 * ==========================================================
 */
router.get(
  "/auth/login",
  authenticateToken,
  async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;

      const result = await pool.query(
        `
        SELECT app_key
        FROM broker_credentials
        WHERE user_id = $1
          AND broker_name = 'ICICI'
          AND is_active = true
        `,
        [userId]
      );

      if (result.rowCount === 0) {
        return res
          .status(400)
          .send("ICICI API key not configured for user");
      }

      const apiKey = result.rows[0].app_key;

      const loginUrl =
        "https://api.icicidirect.com/apiuser/login?api_key=" +
        encodeURIComponent(apiKey);

      return res.redirect(loginUrl);
    } catch (err) {
      log("ICICI login redirect failed", err);
      return res.status(500).send("ICICI login failed");
    }
  }
);

/**
 * ==========================================================
 * GET /api/icici/auth/callback  (PUBLIC, POPUP)
 * ----------------------------------------------------------
 * ICICI redirects browser here with ?apisession=XXXX
 * Sends apisession back to opener window
 * ==========================================================
 */
router.get("/auth/callback", (req, res) => {
  const apisession = String(req.query.apisession || "").trim();

  if (!apisession) {
    return res.send(`
      <script>
        window.opener?.postMessage(
          { type: "ICICI_LOGIN_ERROR", error: "Missing apisession" },
          "*"
        );
        window.close();
      </script>
    `);
  }

  return res.send(`
    <script>
      window.opener?.postMessage(
        { type: "ICICI_LOGIN", apisession: "${apisession}" },
        "*"
      );
      window.close();
    </script>
  `);
});

/**
 * ==========================================================
 * POST /api/icici/auth/callback  (AUTHENTICATED)
 * ----------------------------------------------------------
 * Exchanges apisession → Breeze session_token
 * ==========================================================
 */
router.post(
  "/auth/callback",
  authenticateToken,
  async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const { apisession } = req.body;

      if (!apisession) {
        return res.status(400).json({ error: "Missing apisession" });
      }

      /**
       * SessionService:
       * - reads encrypted creds from broker_credentials
       * - exchanges apisession with ICICI
       * - stores session_token (DB + Redis)
       */
      const session =
        await SessionService.getInstance().createICICISession(
          userId,
          apisession
        );

      return res.json({
        success: true,
        session_token: session.session_token,
      });
    } catch (err: any) {
      log("ICICI POST callback failed", err);
      return res
        .status(500)
        .json({ error: err.message || "ICICI auth failed" });
    }
  }
);

export const iciciAuthRouter = router;
export default router;
