// backend/src/routes/iciciAuth.ts

import { Router } from "express";
import debug from "debug";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { createBreezeLoginSession } from "../utils/breezeSession.js";

const log = debug("apex:icici:auth");
const router = Router();

/**
 * ========================================================================
 * GET /api/icici/auth/login
 * ------------------------------------------------------------------------
 * Public endpoint.
 * Redirects user (popup) to ICICI Direct login page.
 *
 * The frontend popup will call:
 *    `${BACKEND}/api/icici/auth/login?api_key=XXXXX`
 *
 * If api_key is missing → fallback to env DEFAULT_ICICI_APPKEY.
 *
 * ⚠ This must remain PUBLIC. No JWT.
 * The popup is opened by the browser, so Authorization headers DO NOT exist.
 * ========================================================================
 */
router.get("/auth/login", (req, res) => {
  try {
    const apiKey = String(
      req.query.api_key || process.env.DEFAULT_ICICI_APPKEY || ""
    ).trim();

    if (!apiKey) {
      log("Missing api_key in /auth/login request");
      return res.status(400).send("Missing api_key");
    }

    const loginUrl = `https://api.icicidirect.com/apiuser/login?api_key=${encodeURIComponent(
      apiKey
    )}`;

    log("Redirecting to ICICI login:", loginUrl);
    return res.redirect(loginUrl);
  } catch (err: any) {
    log("Error in /auth/login:", err);
    return res.status(500).send("ICICI Login Redirect Failed");
  }
});

/**
 * ========================================================================
 * GET /api/icici/auth/callback
 * ------------------------------------------------------------------------
 * ICICI redirects user here after successful login:
 *      ?apisession=XXXXX
 *
 * This endpoint is PUBLIC and returns a temporary HTML page that sends the
 * apisession back to the opener window via postMessage.
 *
 * Frontend popup listener receives:
 *    { type: "ICICI_LOGIN", apisession: "XXXXX" }
 *
 * If error:
 *    { type: "ICICI_LOGIN_ERROR", error: "..." }
 *
 * Then window closes automatically.
 * ========================================================================
 */
router.get("/auth/callback", (req, res) => {
  try {
    const apisession = String(req.query.apisession || "").trim();

    if (!apisession) {
      log("Missing apisession in callback");

      return res.send(`
        <html><body>
          <h3>ICICI callback received without apisession</h3>
          <script>
            if (window.opener) {
              window.opener.postMessage(
                { type: "ICICI_LOGIN_ERROR", error: "Missing apisession" },
                "*"
              );
              window.close();
            } else {
              document.body.innerHTML += "<p>Please close this window.</p>";
            }
          </script>
        </body></html>
      `);
    }

    // Successful login → send apisession to frontend popup
    return res.send(`
      <html><body>
        <h3>ICICI Login Successful — you may close this window</h3>
        <script>
          (function(){
            try {
              if (window.opener) {
                window.opener.postMessage(
                  { type: "ICICI_LOGIN", apisession: "${apisession}" },
                  "*"
                );
                window.close();
              } else {
                document.body.innerHTML += "<p>No opener detected.</p>";
              }
            } catch(e) {
              if (window.opener) {
                window.opener.postMessage(
                  { type: "ICICI_LOGIN_ERROR", error: "Callback postMessage failed" },
                  "*"
                );
                window.close();
              } else {
                document.body.innerHTML += "<p>Callback failed.</p>";
              }
            }
          })();
        </script>
      </body></html>
    `);
  } catch (err: any) {
    log("Error in GET /auth/callback:", err);
    return res.status(500).send("ICICI callback processing failed");
  }
});

/**
 * ========================================================================
 * POST /api/icici/auth/callback
 * ------------------------------------------------------------------------
 * Authenticated server-to-server Breeze login.
 *
 * Frontend calls this AFTER receiving the temporary "apisession" from popup.
 *
 * Required JSON body:
 * {
 *   "apisession": "XXXXX",
 *   "api_key":    "APPKEY",
 *   "api_secret": "SECRET"
 * }
 *
 * Server will:
 *   - Exchange apisession + app key/secret with ICICI
 *   - Receive a Breeze JWT
 *   - Store encrypted credentials in DB
 *
 * Returns:
 *   { success: true, session_token: "<breeze-jwt>" }
 * ========================================================================
 */
router.post(
  "/auth/callback",
  authenticateToken,
  async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const { apisession, api_key, api_secret } = req.body;

      if (!apisession || !api_key || !api_secret) {
        return res.status(400).json({
          error:
            "Missing parameters: apisession, api_key, api_secret required",
        });
      }

      const session = await createBreezeLoginSession(
        userId,
        api_key,
        api_secret,
        apisession
      );

      return res.json({
        success: true,
        session_token: session.jwtToken,
      });
    } catch (err: any) {
      log("Error in POST /auth/callback:", err);
      return res
        .status(500)
        .json({ error: err.message || "Callback processing failed" });
    }
  }
);

export const iciciAuthRouter = router;
export default router;
