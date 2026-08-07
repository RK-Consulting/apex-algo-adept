// backend/src/routes/icici/authCallback.ts
/**
 * ICICI Breeze Authentication Callback Handler
 * Handles the 2-step exchange: apisession (login) -> SessionToken (API usage)
 *
 * BUG 8 FIX — attempts tracking moved here from iciciGuard:
 * attempts is now incremented ONLY when the ICICI apisession exchange fails.
 * This correctly models "failed login attempts" as failures ICICI actually sees,
 * not as Connect button clicks. Lock is applied here when attempts >= MAX_LOGIN_ATTEMPTS.
 */
import { Router } from "express";
import debug from "debug";
import axios from "axios";
import crypto from "crypto";
import { iciciLimiter } from "../../../../shared/middleware/rateLimiter.js";
import { SessionService } from "../breeze.session-service.js";
import { query } from "../../../../config/database.js";

const router = Router();
const log = debug("alphaforge:icici:callback");

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "https://alphaforge.skillsifter.in";
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MIN = 15;

// ── Decrypt helper ────────────────────────────────────────────────────────────
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
        <p>Your session is now active. This window will close...</p>
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

      // 2. Atomically transition LOGIN_INITIATED → CALLBACK_RECEIVED and get userId.
      //    This route is JWT-free (no userId in request), so we identify the user
      //    by finding the most recent pending login. The subquery is needed because
      //    PostgreSQL UPDATE does not support ORDER BY / LIMIT directly.
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

      // 3. Store apisession for audit trail
      await query(
        `UPDATE icici_login_attempts SET current_apisession = $1 WHERE user_id = $2`,
        [apisession, currentUserId]
      );

      // 4. Load credentials — no is_active filter (connect route sets it false)
      const credsResult = await query(
        `SELECT app_key, app_secret FROM broker_credentials
         WHERE user_id = $1::uuid AND broker_name = 'ICICI'`,
        [currentUserId]
      );

      if (credsResult.rowCount === 0) throw new Error("API keys not found.");

      // 5. Decrypt — DB stores AES-256-GCM encrypted JSON blobs
      const plainAppKey    = decryptCredential(credsResult.rows[0].app_key);
      const plainAppSecret = decryptCredential(credsResult.rows[0].app_secret);

      // 6. Exchange apisession → permanent SessionToken
      //    ICICI Breeze endpoint: /breezeapi/api/v1/customerdetails
      //    Response field: Success.SessionToken (capital S and T)
      //    Fallback: Success.session_token (some API versions return lowercase)
      const exchangeResponse = await axios.post(
        "https://api.icicidirect.com/breezeapi/api/v1/customerdetails",
        {
          SessionToken: apisession,
          AppKey: plainAppKey,
        }
      );

      const sessionData = exchangeResponse.data;

      if (!sessionData || !sessionData.Success) {
        throw new Error(
          sessionData?.Message || "Failed to exchange apisession for a valid session token."
        );
      }

      // Handle both casing variants from different ICICI API versions
      const finalApiToken =
        sessionData.Success.SessionToken || sessionData.Success.session_token;

      if (!finalApiToken) {
        throw new Error("ICICI returned Success but no SessionToken in response.");
      }

      // 7. Save session to Redis + icici_sessions table
      await SessionService.getInstance().saveSession(currentUserId!, {
        api_key:       plainAppKey,
        api_secret:    plainAppSecret,
        session_token: finalApiToken,
      });

      // 8. Finalize FSM: SESSION_ACTIVE, reset attempts to 0
      await query(
        `UPDATE icici_login_attempts
         SET state = 'SESSION_ACTIVE',
             attempts = 0,
             last_error_message = NULL,
             updated_at = NOW()
         WHERE user_id = $1::uuid`,
        [currentUserId]
      );

      log("✅ ICICI connection established for user: %s", currentUserId);
      return res.send(getSuccessPage());

    } catch (err: any) {
      console.error("❌ ICICI CALLBACK ERROR:", err.message);
      log("❌ ICICI CALLBACK ERROR: %s", err.message);

      if (currentUserId) {
        // BUG 8 FIX: Increment attempts on every real ICICI exchange failure.
        // This is the ONLY place attempts should be incremented — when the
        // apisession exchange with ICICI actually fails (bad credentials, expired
        // token, etc.), not on every Connect button click.
        const attemptResult = await query(
          `UPDATE icici_login_attempts
           SET state = 'FAILED',
               attempts = attempts + 1,
               last_error_message = $1,
               updated_at = NOW()
           WHERE user_id = $2::uuid
           RETURNING attempts`,
          [err.message, currentUserId]
        );

        const newAttempts = attemptResult.rows[0]?.attempts ?? 0;

        // Lock if too many real failures
        if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
          await query(
            `UPDATE icici_login_attempts
             SET state = 'LOCKED',
                 locked_until = NOW() + INTERVAL '${LOCK_DURATION_MIN} minutes'
             WHERE user_id = $1::uuid`,
            [currentUserId]
          );
          log("🔒 User %s locked after %d failed attempts", currentUserId, newAttempts);
        }
      }

      return res.send(getErrorPage(err.message));
    }
  }
);

export default router;
export const iciciAuthCallbackRouter = router;
