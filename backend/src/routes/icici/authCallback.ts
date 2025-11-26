// backend/src/routes/icici/authCallback.ts
import { Router } from "express";
const router = Router();

/**
 * Breeze R50 callback:
 * ICICI redirects user here with:
 *   ?session_token=xxxxx
 *
 * We DO NOT get “code”.
 * We DO NOT use OAuth flow.
 */
router.get("/auth/callback", async (req, res) => {
  const sessionToken = req.query.session_token || "";

  if (!sessionToken) {
    return res.send("<h3>Missing session_token from ICICI</h3>");
  }

  return res.send(`
    <html>
      <head><title>ICICI Login Completed</title></head>
      <body>
        <h3>ICICI Login Successful</h3>
        <p>Processing session token…</p>

        <script>
          const token = "${sessionToken}";
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
