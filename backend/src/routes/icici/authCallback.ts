// backend/src/routes/icici/authCallback.ts
/**
 * ICICI Breeze Authentication Callback Handler
 * Handles callback in POPUP window - closes popup after success
 */
import { Router } from "express";
import debug from "debug";
import { iciciLimiter } from "../../middleware/rateLimiter.js";
import { SessionService } from "../../services/sessionService.js";
import { query } from "../../config/database.js";

const router = Router();
const log = debug("alphaforge:icici:callback");

// Use environment variable for security, fallback to your known production URL
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "https://alphaforge.skillsifter.in";

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
        <style>
          body { font-family: sans-serif; text-align: center; padding-top: 50px; background: #f0fff4; }
          .loader { color: #2f855a; }
        </style>
      </head>
      <body>
        <h2 class="loader">✅ ICICI Connected Successfully</h2>
        <p>This window will close automatically...</p>
        <script>
          if (window.opener && !window.opener.closed) {
            window.opener.postMessage(
              { type: 'ICICI_CONNECTED', success: true },
              '${FRONTEND_ORIGIN}'
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
  const sanitizedMsg = errorMessage.replace(/'/g, "\\'");
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>ICICI Connection Failed</title>
        <meta charset="utf-8" />
        <style>
          body { font-family: sans-serif; text-align: center; padding-top: 50px; background: #fff5f5; }
          .error { color: #c53030; }
        </style>
      </head>
      <body>
        <h2 class="error">❌ ICICI Connection Failed</h2>
        <p>${errorMessage}</p>
        <script>
          if (window.opener && !window.opener.closed) {
            window.opener.postMessage(
              { type: 'ICICI_CONNECTED', success: false, error: '${sanitizedMsg}' },
              '${FRONTEND_ORIGIN}'
            );
          }
          setTimeout(() => window.close(), 4000);
        </script>
      </body>
    </html>
  `;
}



router.all(
  "/callback",
  iciciLimiter,
  async (req, res) => {
    let currentUserId: string | null = null;
    
    console.log("🟢 ICICI CALLBACK HIT");
    
    try {
      // 1. Extract API Session
      const apisession = (
        req.query.apisession || 
        req.body?.apisession || 
        req.query.api_session || 
        req.body?.api_session
      ) as string;

      if (!apisession) {
        throw new Error("Missing session parameter from ICICI");
      }

      // 2. Map Callback to the correct User
      // We look for the most recent INITIATED attempt to identify who is logging in
      const loginAttempt = await query(
        `SELECT user_id 
         FROM icici_login_attempts 
         WHERE state = 'LOGIN_INITIATED' 
         ORDER BY updated_at DESC 
         LIMIT 1`
      );

      if (loginAttempt.rowCount === 0) {
        throw new Error("No active login request found. Please try connecting again.");
      }

      currentUserId = loginAttempt.rows[0].user_id;
      console.log("🟢 Callback mapped to user:", currentUserId);

      // 3. Load Credentials
      const credsResult = await query(
        `SELECT app_key, app_secret 
         FROM broker_credentials 
         WHERE user_id = $1::uuid 
           AND broker_name = 'ICICI' 
           AND is_active = true`,
        [currentUserId]
      );

      if (credsResult.rowCount === 0) {
        throw new Error("ICICI API credentials not found in your settings.");
      }

      const { app_key, app_secret } = credsResult.rows[0];

      // 4. Save Session via SessionService
      // Note: In your current flow, apisession is used as the session token
      await SessionService.getInstance().saveSession(currentUserId!, {
        api_key: app_key,
        api_secret: app_secret,
        session_token: apisession
      });

      // 5. Finalize State Machine
      await query(
        `UPDATE icici_login_attempts 
         SET state = 'SESSION_ACTIVE', 
             attempts = 0, 
             updated_at = NOW() 
         WHERE user_id = $1::uuid AND state = 'LOGIN_INITIATED'`,
        [currentUserId]
      );

      console.log("✅ ICICI connection successful for user:", currentUserId);
      return res.send(getSuccessPage());

    } catch (err: any) {
      console.error("❌ ICICI CALLBACK ERROR:", err.message);

      // SCOPED FSM UPDATE: Only fail the attempt for THIS user
      if (currentUserId) {
        try {
          console.log(`🟡 Updating FSM → FAILED for user: ${currentUserId}`);
          await query(
            `UPDATE icici_login_attempts 
             SET state = 'FAILED', 
                 updated_at = NOW() 
             WHERE user_id = $1::uuid AND state = 'LOGIN_INITIATED'`,
            [currentUserId]
          );
        } catch (fsmErr) {
          console.error("❌ Failed to update FSM state to FAILED:", fsmErr);
        }
      }

      return res.send(getErrorPage(err.message));
    }
  }
);

export default router;
export const iciciAuthCallbackRouter = router;
