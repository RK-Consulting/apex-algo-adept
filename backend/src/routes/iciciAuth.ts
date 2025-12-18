import { Router } from "express";
import debug from "debug";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { SessionService } from "../services/sessionService.js";

const log = debug("apex:icici:auth");
const router = Router();

/**
 * ==========================================================
 * GET /api/icici/auth/login  (PUBLIC)
 * ==========================================================
 */
router.get("/auth/login", (req, res) => {
  const apiKey = String(
    req.query.api_key || process.env.DEFAULT_ICICI_APPKEY || ""
  ).trim();

  if (!apiKey) {
    return res.status(400).send("Missing api_key");
  }

  const loginUrl =
    "https://api.icicidirect.com/apiuser/login?api_key=" +
    encodeURIComponent(apiKey);

  return res.redirect(loginUrl);
});

/**
 * ==========================================================
 * GET /api/icici/auth/callback  (PUBLIC, POPUP)
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
 * ==========================================================
 * Exchanges apisession → Breeze session_token
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
       * SessionService must:
       * - read encrypted ICICI creds from user_credentials
       * - call Breeze CustomerDetails API
       * - store session_token
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
