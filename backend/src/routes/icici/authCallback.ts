// backend/src/routes/icici/authCallback.ts
// backend/src/routes/icici/authCallback.ts
import { Router } from "express";

const router = Router();

/**
 * ICICI Breeze R50 callback handler
 * Supports multiple possible redirect formats:
 *   ?apisession=XXXX
 *   ?session_token=XXXX
 *   ?code=XXXX
 */
router.get("/auth/callback", async (req, res) => {
  // Extract ANY format ICICI may return
  const rawToken =
    req.query.apisession ||
    req.query.session_token ||
    req.query.code ||
    "";

  // Convert to a safe string
  const sessionFromICICI = String(rawToken || "").trim();

  if (!sessionFromICICI) {
    return res.send("<h3>Missing apisession / session_token from ICICI</h3>");
  }

  // Ensure HTML-safe string output
  const safeToken = sessionFromICICI.replace(/"/g, "&quot;");

  return res.send(`
    <html>
      <body>
        <h3>ICICI Login Successful</h3>
        <p>Processing session token…</p>

        <script>
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
        </script>
      </body>
    </html>
  `);
});

export { router as iciciAuthCallbackRouter };
