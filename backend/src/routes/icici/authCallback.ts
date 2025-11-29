// backend/src/routes/icici/authCallback.ts
import { Router } from "express";

const router = Router();

/**
 * ICICI Breeze R50 callback handler
 * Supports:
 *   /auth/callback?apisession=XXXX
 *   /auth/callback?session_token=XXXX
 *   /auth/callback?code=XXXX
 */
router.get("/auth/callback", async (req, res) => {
  // Extract & normalize the value (handles array[] params also)
  const rawToken =
    req.query.apisession ||
    req.query.session_token ||
    req.query.code ||
    "";

  const sessionFromICICI = Array.isArray(rawToken)
    ? rawToken[0]
    : String(rawToken).trim();

  if (!sessionFromICICI) {
    return res.send("<h3>Missing apisession / session_token from ICICI</h3>");
  }

  // Escape token to avoid injecting raw HTML
  const safeToken = sessionFromICICI.replace(/"/g, "&quot;");

  res.setHeader("Content-Type", "text/html; charset=utf-8");

  return res.send(`
    <!DOCTYPE html>
    <html>
      <body>
        <h3>ICICI Login Successful</h3>
        <p>Processing session token…</p>

        <script>
          (function() {
            const token = "${safeToken}";
            if (window.opener) {
              window.opener.postMessage(
                { type: "ICICI_LOGIN", session_token: token },
                "*"
              );
              window.close();
            } else {
              document.body.innerHTML += "<p>Please close this window.</p>";
            }
          })();
        </script>
      </body>
    </html>
  `);
});

export { router as iciciAuthCallbackRouter };


