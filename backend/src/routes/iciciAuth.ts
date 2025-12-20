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
 * - Authenticated (JWT)
 * - Reads encrypted ICICI app_key from broker_credentials
 * - Redirects browser to ICICI Direct login page
 * ==========================================================
 */
router.get(
  "/auth/login",
  authenticateToken,
  async (req: AuthRequest, res) => {
    try {
      /* ------------------------------
         SERVER CONTEXT
      ------------------------------ */
      const srv_user_id = req.user!.userId;
      const srv_broker_name = "ICICI";

      /* ------------------------------
         DB FETCH
      ------------------------------ */
      const db_result = await pool.query(
        `
        SELECT app_key
        FROM broker_credentials
        WHERE user_id = $1
          AND broker_name = $2
          AND is_active = true
        `,
        [srv_user_id, srv_broker_name]
      );

      if ((db_result.rowCount ?? 0) === 0) {
        return res
          .status(400)
          .send("ICICI API key not configured for user");
      }

      /* ------------------------------
         DB → SERVER MAPPING
         (NO DECRYPT HERE — handled downstream)
      ------------------------------ */
      const db_app_key_payload = db_result.rows[0].app_key;

      /* ------------------------------
         SERVER VARIABLE (INTENT CLEAR)
      ------------------------------ */
      const srv_app_key = db_app_key_payload;

      /* ------------------------------
         REDIRECT
      ------------------------------ */
      const icici_login_url =
        "https://api.icicidirect.com/apiuser/login?api_key=" +
        encodeURIComponent(srv_app_key);

      return res.redirect(icici_login_url);
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
  const req_apisession = String(req.query.apisession || "").trim();

  if (!req_apisession) {
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
        { type: "ICICI_LOGIN", apisession: "${req_apisession}" },
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
      /* ------------------------------
         SERVER CONTEXT
      ------------------------------ */
      const srv_user_id = req.user!.userId;
      const req_apisession = req.body?.apisession;

      if (!req_apisession) {
        return res.status(400).json({ error: "Missing apisession" });
      }

      /* ------------------------------
         SESSION SERVICE
         - Reads encrypted creds from broker_credentials
         - Exchanges apisession with ICICI
         - Persists session_token
      ------------------------------ */
      const srv_session =
        await SessionService.getInstance().createICICISession(
          srv_user_id,
          req_apisession
        );

      return res.json({
        success: true,
        session_token: srv_session.session_token,
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
