/**
 * ICICI Breeze Authentication Callback Handler
 * Handles callback in POPUP window - closes popup after success
 */
import { Router } from "express";
import debug from "debug";
import { iciciLimiter } from "../../middleware/rateLimiter.js";
import { generateIciciSession } from "../../services/breezeClient.js";
import { SessionService } from "../../services/sessionService.js";
import { query } from "../../config/database.js";

const router = Router();
const log = debug("alphaforge:icici:callback");

/**
 * Success page HTML - closes popup and notifies parent window
 */
function getSuccessPage(): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>ICICI Connected</title>
        <meta charset="utf-8" />
      </head>
      <body>
        <h2>ICICI Connected Successfully</h2>
        <script>
          console.log('ICICI callback success');
          if (window.opener && !window.opener.closed) {
            window.opener.postMessage(
              { type: 'ICICI_CONNECTED', success: true },
              '${process.env.FRONTEND_ORIGIN || "https://alphaforge.skillsifter.in"}'
            );
          }
          setTimeout(() => window.close(), 1500);
        </script>
      </body>
    </html>
  `;
}

/**
 * Error page HTML - shows error and closes popup
 */
function getErrorPage(errorMessage: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>ICICI Connection Failed</title>
        <meta charset="utf-8" />
      </head>
      <body>
        <h2>ICICI Connection Failed</h2>
        <pre>${errorMessage}</pre>
        <script>
          console.error('ICICI callback failed:', '${errorMessage.replace(/'/g, "\\'")}');
          if (window.opener && !window.opener.closed) {
            window.opener.postMessage(
              { type: 'ICICI_CONNECTED', success: false, error: '${errorMessage.replace(/'/g, "\\'")}' },
              '${process.env.FRONTEND_ORIGIN || "https://alphaforge.skillsifter.in"}'
            );
          }
          setTimeout(() => window.close(), 3000);
        </script>
      </body>
    </html>
  `;
}

router.all(
  "/callback",
  iciciLimiter,
  async (req, res) => {
    console.log("🟢 ICICI CALLBACK HIT");
    console.log("➡️ Method:", req.method);
    console.log("➡️ Query:", req.query);
    console.log("➡️ Body:", req.body);

    try {
      const apisession =
        (req.query.apisession ||
         req.body?.apisession ||
         req.query.api_session ||
         req.body?.api_session) as string;

      console.log("➡️ Extracted apisession:", apisession);

      if (!apisession) {
        console.error("❌ Missing apisession parameter");
        return res.send(getErrorPage("Missing session parameter from ICICI"));
      }

      console.log("🟢 Fetching LOGIN_INITIATED state");

      const loginAttempt = await query(
        `SELECT user_id
         FROM icici_login_attempts
         WHERE state = 'LOGIN_INITIATED'
         ORDER BY updated_at DESC
         LIMIT 1`
      );

      console.log("➡️ loginAttempt.rowCount:", loginAttempt.rowCount);

      if (loginAttempt.rowCount === 0) {
        throw new Error("No active ICICI login session found");
      }

      const userId = loginAttempt.rows[0].user_id;
      console.log("🟢 Callback mapped to user:", userId);

      console.log("🟢 Fetching ICICI credentials");

      const credsResult = await query(
        `SELECT app_key, app_secret
         FROM broker_credentials
         WHERE user_id = $1::uuid
           AND broker_name = 'ICICI'
           AND is_active = true`,
        [userId]
      );

      console.log("➡️ credsResult.rowCount:", credsResult.rowCount);

      if (credsResult.rowCount === 0) {
        throw new Error("ICICI credentials not found");
      }

      const { app_key, app_secret } = credsResult.rows[0];
      console.log("🟢 Credentials loaded");

      console.log("🟡 Calling generateIciciSession()");
      const sessionToken = await generateIciciSession(
        userId,
        app_key,
        app_secret,
        apisession
      );

      console.log("➡️ generateIciciSession returned:", sessionToken);

      if (!sessionToken) {
        throw new Error("No session_token returned from ICICI");
      }

      console.log("🟢 Saving session");

      await SessionService.getInstance().saveSession(userId, {
        api_key: app_key,
        api_secret: app_secret,
        session_token: sessionToken
      });

      console.log("🟢 Updating FSM → SESSION_ACTIVE");

      await query(
        `UPDATE icici_login_attempts
         SET state = 'SESSION_ACTIVE',
             attempts = 0,
             updated_at = NOW()
         WHERE user_id = $1::uuid`,
        [userId]
      );

      console.log("✅ ICICI connection successful for user:", userId);

      return res.send(getSuccessPage());
    } catch (err: any) {
      console.error("❌ ICICI CALLBACK ERROR:", err);

      try {
        console.log("🟡 Updating FSM → FAILED");
        await query(
          `UPDATE icici_login_attempts
           SET state = 'FAILED',
               updated_at = NOW()
           WHERE state = 'LOGIN_INITIATED'`
        );
      } catch (fsmErr) {
        console.error("❌ FSM update failed:", fsmErr);
      }

      return res.send(getErrorPage(err.message));
    }
  }
);

export default router;
export const iciciAuthCallbackRouter = router;
