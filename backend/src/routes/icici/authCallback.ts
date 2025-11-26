// backend/src/routes/icici/authCallback.ts
import { Router } from "express";
import { authenticateToken, AuthRequest } from "../../middleware/auth.js";
import { query } from "../../config/database.js";
import { encryptDataRaw, getEncryptionKey } from "../../utils/credentialEncryptor.js";
import { invalidateBreezeInstance } from "../../utils/breezeSession.js";
import debug from "debug";

const log = debug("apex:icici:callback");
const router = Router();

/**
 * Simple callback endpoint for ICICI/Breeze OAuth or login flow
 * Breeze may redirect the user to your backend after auth — capture tokens here.
 */
router.get("/auth/callback", async (req, res) => {
  const sessionToken = req.query.session_token || "";
  const apiKey = req.query.api_key || "";
  const user = req.query.user || "";

  return res.send(`
    <html>
      <head><title>ICICI Login Completed</title></head>
      <body>
        <h3>ICICI Login Successful</h3>
        <p>Processing session token…</p>

        <script>
          const session_token = "${sessionToken}";
          const api_key = "${apiKey}";
          const user = "${user}";

          // Callback to your frontend window (React)
          if (window.opener) {
            window.opener.postMessage(
              { type: "ICICI_LOGIN", session_token, api_key, user },
              "*"
            );
            window.close();
          } else {
            document.body.innerHTML += "<p>Please close this window.</p>";
          }
        </script>
      </body>
    </html>
  `);
});


/**
 * POST /api/icici/auth/callback
 * Called after user enters ICICI API Key & Secret
 */
router.post("/auth/callback", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const { api_key, api_secret } = req.body;
    if (!api_key || !api_secret) {
      return res.status(400).json({ error: "api_key and api_secret are required" });
    }

    log("Received ICICI credentials for user %s", userId);

    // Encrypt credentials
    const encKey = getEncryptionKey();
    //const encApiKey = await encryptData(api_key, encKey);
    //const encApiSecret = await encryptData(api_secret, encKey);
    const encApiKey = await encryptDataRaw(api_key, encKey);
    const encApiSecret = await encryptDataRaw(api_secret, encKey);


    // Delete old sessions and credentials
    await query(
      `UPDATE user_credentials
       SET icici_api_key = $1,
           icici_api_secret = $2,
           icici_session_token = NULL,
           refresh_token = NULL,
           updated_at = NOW()
       WHERE user_id = $3`,
      [JSON.stringify(encApiKey), JSON.stringify(encApiSecret), userId]
    );

    invalidateBreezeInstance(userId);

    return res.json({
      success: true,
      message: "ICICI credentials saved. Session will generate on first API call."
    });
  } catch (err: any) {
    log("Callback error:", err);
    return res.status(500).json({
      success: false,
      error: err?.message || "Failed to process ICICI callback"
    });
  }
});

export { router as iciciAuthCallbackRouter };
