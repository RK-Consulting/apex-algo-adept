// backend/src/routes/iciciAuth.ts

import { Router } from "express";
import debug from "debug";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { SessionService } from "../services/sessionService.js";
import { decryptJson } from "../utils/crypto.js"; // MUST already exist

const log = debug("apex:icici:auth");
const router = Router();

/**
 * ==========================================================
 * GET /api/icici/auth/login  (PUBLIC)
 * ==========================================================
 */
router.get("/auth/login", async (req, res) => {
  try {
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
  } catch (err) {
    log("Login redirect failed", err);
    return res.status(500).send("ICICI login failed");
  }
});

/**
 * ==========================================================
 * GET /api/icici/auth/callback  (PUBLIC)
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
       * 🔐 Fetch encrypted credentials from DB
       */
      const creds =
        await SessionService.getInstance().getUserICICICredentials(userId);

      if (!creds) {
        return res.status(400).json({
          error: "ICICI credentials not configured for user",
        });
      }

      const { api_key, api_secret } = decryptJson(creds);

      /**
       * 🔁 Exchange session with ICICI
       */
      const session =
        await SessionService.getInstance().createICICISession(
          userId,
          api_key,
          api_secret,
          apisession
        );

      return res.json({
        success: true,
        session_token: session.session_token,
      });
    } catch (err: any) {
      log("POST callback failed", err);
      return res
        .status(500)
        .json({ error: err.message || "ICICI auth failed" });
    }
  }
);

export const iciciAuthRouter = router;
export default router;
