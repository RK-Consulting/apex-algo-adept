// backend/src/routes/icici/authCallback.ts
/**
 * ICICI Breeze Authentication Callback Handler
 * Handles the 2-step exchange: apisession (login) -> SessionToken (API usage)
 */
import { Router } from "express";
import debug from "debug";
import axios from "axios"; // Ensure axios is installed for the exchange call
import { iciciLimiter } from "../../middleware/rateLimiter.js";
import { SessionService } from "../../services/sessionService.js";
import { query } from "../../config/database.js";

const router = Router();
const log = debug("alphaforge:icici:callback");

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "https://alphaforge.skillsifter.in";

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
        <p>Your institutional state is now ACTIVE. This window will close...</p>
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
    
    log("🟢 ICICI CALLBACK HIT");
    
    try {
      // 1. Extract the temporary apisession from the redirect URL
      const apisession = (req.query.apisession || req.body?.apisession) as string;

      if (!apisession) {
        throw new Error("ICICI did not provide an apisession parameter.");
      }

      // 2. Identify the user by looking for CALLBACK_RECEIVED (set by our iciciGuard)
      // We order by updated_at to ensure we get the absolute latest attempt
      const loginAttempt = await query(
        `SELECT user_id FROM icici_login_attempts 
         WHERE state = 'CALLBACK_RECEIVED' 
         ORDER BY updated_at DESC LIMIT 1`
      );

      if (loginAttempt.rowCount === 0) {
        throw new Error("No pending login session found. Please try again.");
      }

      currentUserId = loginAttempt.rows[0].user_id;

      // 3. Update FSM with the apisession for audit/handshake tracking
      await query(
        `UPDATE icici_login_attempts SET current_apisession = $1 WHERE user_id = $2`,
        [apisession, currentUserId]
      );

      // 4. Load static App Credentials
      const credsResult = await query(
        `SELECT app_key, app_secret FROM broker_credentials 
         WHERE user_id = $1::uuid AND broker_name = 'ICICI' AND is_active = true`,
        [currentUserId]
      );

      if (credsResult.rowCount === 0) throw new Error("API keys not found.");
      const { app_key, app_secret } = credsResult.rows[0];

      // 5. THE CRITICAL STEP: Exchange apisession for SessionToken
      // Based on ICICI Documentation: https://api.icicidirect.com/breezeapi/documents/index.html#customerdetails
      const exchangeResponse = await axios.post('https://api.icicidirect.com/breezeapi/api/v1/customerdetails', {
        SessionToken: apisession, // For the customerdetails call, we pass the login apisession
        AppKey: app_key
      });

      const sessionData = exchangeResponse.data;
      
      // In ICICI Breeze, the exchange returns a JSON. 
      // We must check if 'Success' field exists or status is 200
      if (!sessionData || !sessionData.Success) {
          throw new Error(sessionData?.Message || "Failed to exchange apisession for a valid API session.");
      }

      // The final permanent token is usually in sessionData.Success.session_token
      const finalApiToken = sessionData.Success.session_token;

      // 6. Save permanent Session to Redis/Postgres via SessionService
      await SessionService.getInstance().saveSession(currentUserId!, {
        api_key: app_key,
        api_secret: app_secret,
        session_token: finalApiToken
      });

      // 7. Finalize State Machine to SESSION_ACTIVE
      await query(
        `UPDATE icici_login_attempts 
         SET state = 'SESSION_ACTIVE', 
             attempts = 0, 
             last_error_message = NULL,
             updated_at = NOW() 
         WHERE user_id = $1::uuid`,
        [currentUserId]
      );

      // 8. Update last_connected in credentials for the Aggregator/Analytics
      await query(
        `UPDATE broker_credentials SET last_connected = NOW() WHERE user_id = $1 AND broker_name = 'ICICI'`,
        [currentUserId]
      );

      log("✅ ICICI connection fully established for user: %s", currentUserId);
      return res.send(getSuccessPage());

    } catch (err: any) {
      log("❌ ICICI CALLBACK ERROR: %s", err.message);

      if (currentUserId) {
        await query(
          `UPDATE icici_login_attempts 
           SET state = 'FAILED', 
               last_error_message = $1,
               updated_at = NOW() 
           WHERE user_id = $2::uuid`,
          [err.message, currentUserId]
        );
      }

      return res.send(getErrorPage(err.message));
    }
  }
);

export default router;
export const iciciAuthCallbackRouter = router;
