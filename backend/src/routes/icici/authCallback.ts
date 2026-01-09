// backend/src/routes/icici/authCallback.ts
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


router.all(
  "/callback",
  iciciLimiter,
  async (req, res) => {
    try {
      const apisession = (req.method === "GET"
        ? req.query.apisession
        : req.body?.apisession) as string;

      if (!apisession) {
        log("❌ Missing apisession parameter");
        return res.send(getErrorPage("Missing session parameter from ICICI"));
      }

      // 1) Resolve user from latest LOGIN_INITIATED attempt
      const loginAttempt = await query(
        `SELECT user_id FROM icici_login_attempts WHERE state = 'LOGIN_INITIATED' 
         ORDER BY updated_at DESC LIMIT 1`
      );

      if (loginAttempt.rowCount === 0) {
        throw new Error("No active ICICI login session found");
      }

      const userId = loginAttempt.rows[0].user_id;
      log("✅ Processing callback for user:", userId);

      // 2) Fetch credentials
      const credsResult = await query(
        `SELECT app_key, app_secret FROM broker_credentials 
         WHERE user_id = $1::uuid AND broker_name = 'ICICI' AND is_active = true`,
        [userId]
      );

      if (credsResult.rowCount === 0) {
        throw new Error("ICICI credentials not found");
      }

      const { app_key, app_secret } = credsResult.rows[0];

      log("✅ Calling generate session...");
      const sessionToken = await generateIciciSession(
        userId,
        app_key,
        app_secret,
        apisession
      );

      if (!sessionToken) {
        throw new Error("No session_token returned from ICICI");
      }

      log("✅ Session token received:", sessionToken.substring(0, 5) + "...");

      // 3) Save session and update FSM
      await SessionService.getInstance().saveSession(userId, {
        api_key: app_key,
        api_secret: app_secret,
        session_token: sessionToken
      });

      await query(
        `UPDATE icici_login_attempts SET state = 'SESSION_ACTIVE', attempts = 0, updated_at = NOW()
         WHERE user_id = $1::uuid`,
        [userId]
      );

      log("✅ ICICI connection successful for user:", userId);

      return res.send(getSuccessPage());
    } catch (err: any) {
      log("❌ Callback error:", err.message);

      try {
        await query(
          `UPDATE icici_login_attempts SET state = 'FAILED', updated_at = NOW()
           WHERE state = 'LOGIN_INITIATED'`
        );
      } catch (fsmErr) {
        log("❌ FSM update failed:", fsmErr);
      }

      return res.send(getErrorPage(err.message));
    }
  }
);

/**
 * Success page HTML - closes popup and notifies parent window
 */
function getSuccessPage(): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>ICICI Connected</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
          }
          .container {
            text-align: center;
            padding: 40px;
            background: rgba(255, 255, 255, 0.15);
            border-radius: 20px;
            backdrop-filter: blur(10px);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            max-width: 400px;
          }
          .icon {
            font-size: 64px;
            margin-bottom: 20px;
            animation: scaleIn 0.5s ease-out;
          }
          h1 {
            margin: 0 0 10px 0;
            font-size: 32px;
            font-weight: 600;
          }
          p {
            font-size: 16px;
            margin: 10px 0;
            opacity: 0.9;
          }
          .spinner {
            border: 3px solid rgba(255,255,255,0.3);
            border-radius: 50%;
            border-top: 3px solid white;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 20px auto 10px;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          @keyframes scaleIn {
            0% { transform: scale(0); }
            50% { transform: scale(1.2); }
            100% { transform: scale(1); }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">✅</div>
          <h1>Connected!</h1>
          <p>ICICI Direct connected successfully</p>
          <div class="spinner"></div>
          <p style="font-size: 14px;">Closing window...</p>
        </div>
        <script>
          console.log('ICICI callback success - notifying parent window');
          
          // Notify parent window of success
          if (window.opener && !window.opener.closed) {
            try {
              window.opener.postMessage(
                { 
                  type: 'ICICI_CONNECTED', 
                  success: true,
                  timestamp: Date.now()
                }, 
                '${process.env.FRONTEND_ORIGIN || "https://alphaforge.skillsifter.in"}'
              );
              console.log('Message sent to parent window');
            } catch (err) {
              console.error('Failed to send message to parent:', err);
            }
          } else {
            console.warn('No parent window found or parent closed');
          }
          
          // Close popup after 2 seconds
          setTimeout(() => {
            console.log('Closing popup window');
            window.close();
            
            // Fallback: try to focus parent if close failed
            setTimeout(() => {
              if (window.opener && !window.opener.closed) {
                window.opener.focus();
              }
            }, 100);
          }, 2000);
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
        <title>Connection Failed</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            color: white;
          }
          .container {
            text-align: center;
            padding: 40px;
            background: rgba(255, 255, 255, 0.15);
            border-radius: 20px;
            backdrop-filter: blur(10px);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            max-width: 450px;
          }
          .icon {
            font-size: 64px;
            margin-bottom: 20px;
          }
          h1 {
            margin: 0 0 10px 0;
            font-size: 28px;
            font-weight: 600;
          }
          .error-message {
            font-size: 14px;
            margin: 15px 0;
            padding: 15px;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 10px;
            word-break: break-word;
          }
          p {
            font-size: 14px;
            margin: 10px 0;
            opacity: 0.9;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">❌</div>
          <h1>Connection Failed</h1>
          <div class="error-message">${errorMessage.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
          <p>This window will close in 5 seconds...</p>
        </div>
        <script>
          console.error('ICICI callback failed:', '${errorMessage.replace(/'/g, "\\'")}');
          
          // Notify parent window of failure
          if (window.opener && !window.opener.closed) {
            try {
              window.opener.postMessage(
                { 
                  type: 'ICICI_CONNECTED', 
                  success: false, 
                  error: '${errorMessage.replace(/'/g, "\\'").replace(/"/g, '\\"')}'
                }, 
                '${process.env.FRONTEND_ORIGIN || "https://alphaforge.skillsifter.in"}'
              );
            } catch (err) {
              console.error('Failed to send error message to parent:', err);
            }
          }
          
          // Close popup after 5 seconds
          setTimeout(() => {
            window.close();
            
            // Fallback: try to focus parent if close failed
            setTimeout(() => {
              if (window.opener && !window.opener.closed) {
                window.opener.focus();
              }
            }, 100);
          }, 5000);
        </script>
      </body>
    </html>
  `;
}

export default router;
export const iciciAuthCallbackRouter = router;
