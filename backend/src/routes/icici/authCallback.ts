// backend/src/routes/icici/authCallback.ts
/**
 * ICICI Breeze Authentication Callback Handler
 * Handles the 2-step exchange: apisession (login) -> SessionToken (API usage)
 */
import { Router } from "express";
import debug from "debug";
import axios from "axios";
import crypto from "crypto";
import { iciciLimiter } from "../../middleware/rateLimiter.js";
import { SessionService } from "../../services/sessionService.js";
import { query } from "../../config/database.js";

const router = Router();
const log = debug("alphaforge:icici:callback");

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "https://alphaforge.skillsifter.in";

// ── Decrypt helper (mirrors credentials.ts) ──────────────────────────────────
function getServerEncryptionKey(): Buffer {
  const masterSecret = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!masterSecret) throw new Error("CREDENTIALS_ENCRYPTION_KEY not configured");
  return crypto.pbkdf2Sync(masterSecret, "alphaforge-credentials-v1", 100_000, 32, "sha256");
}

function decryptCredential(dbPayload: string): string {
  const { encrypted, iv, tag } = JSON.parse(dbPayload);
  const key = getServerEncryptionKey();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64")),
    decipher.final()
  ]).toString("utf8");
}
// ─────────────────────────────────────────────────────────────────────────────

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

      // ✅ FIX 1: Query for LOGIN_INITIATED (not CALLBACK_RECEIVED).
      // The guard middleware isn't applied here (JWT-free route), so nothing
      // pre-transitions the state. We do it atomically right here instead.
      const loginAttempt = await query(
        `UPDATE icici_login_attempts
         SET state = 'CALLBACK_RECEIVED', updated_at = NOW()
         WHERE user_id = (
           SELECT user_id FROM icici_login_attempts
           WHERE state = 'LOGIN_INITIATED'
           ORDER BY updated_at DESC
           LIMIT 1
         )
         RETURNING user_id`
      );

      if (loginAttempt.rowCount === 0) {
        throw new Error("No pending login session found. Please try again.");
      }

      currentUserId = loginAttempt.rows[0].user_id;
      log("🔑 Matched pending login for user: %s", currentUserId);

      // 3. Update FSM with the apisession for audit/handshake tracking
      await query(
        `UPDATE icici_login_attempts SET current_apisession = $1 WHERE user_id = $2`,
        [apisession, currentUserId]
      );

      // ✅ FIX 2: Removed AND is_active = true — connect route sets is_active = false
      // during login initiation to invalidate stale sessions. Credentials still exist.
      const credsResult = await query(
        `SELECT app_key, app_secret FROM broker_credentials 
         WHERE user_id = $1::uuid AND broker_name = 'ICICI'`,
        [currentUserId]
      );

      if (credsResult.rowCount === 0) throw new Error("API keys not found.");

      // ✅ FIX 3 & 4: Decrypt credentials before use.
      // DB stores AES-256-GCM encrypted JSON — must decrypt to plain text
      // before passing to ICICI API or saving to SessionService.
      const plainAppKey    = decryptCredential(credsResult.rows[0].app_key);
      const plainAppSecret = decryptCredential(credsResult.rows[0].app_secret);

      // 5. Exchange apisession for permanent SessionToken
      const exchangeResponse = await axios.post(
        'https://api.icicidirect.com/breezeapi/api/v1/customerdetails',
        {
          SessionToken: apisession,
          AppKey: plainAppKey   // ✅ FIX 3: plain text, not encrypted JSON
        }
      );

      const sessionData = exchangeResponse.data;

      if (!sessionData || !sessionData.Success) {
        throw new Error(sessionData?.Message || "Failed to exchange apisession for a valid API session.");
      }

      const finalApiToken = sessionData.Success.session_token;

      // 6. Save permanent Session to Redis/Postgres via SessionService
      // ✅ FIX 4: Save decrypted plain text credentials, not encrypted blobs
      await SessionService.getInstance().saveSession(currentUserId!, {
        api_key:      plainAppKey,
        api_secret:   plainAppSecret,
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

      // 8. Mark credentials active again and record last_connected
      await query(
        `UPDATE broker_credentials 
         SET is_active = true, last_connected = NOW(), updated_at = NOW()
         WHERE user_id = $1 AND broker_name = 'ICICI'`,
        [currentUserId]
      );

      log("✅ ICICI connection fully established for user: %s", currentUserId);
      return res.send(getSuccessPage());

    } catch (err: any) {
      console.error("❌ ICICI CALLBACK ERROR:", err.message);
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
