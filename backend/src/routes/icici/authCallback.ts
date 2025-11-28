// backend/src/routes/icici/authCallback.ts
import { Router } from "express";

const router = Router();

/**
 * Breeze R50 callback:
 * ICICI redirects user here with:
 *   ?apisession=xxxxx
 *
 * No OAuth code. No session_token.
 */
router.get("/auth/callback", async (req, res) => {
  const apiSession = req.query.apisession || "";

  if (!apiSession) {
    return res.send("<h3>Missing apisession from ICICI</h3>");
  }

  return res.send(`
    <html>
      <head><title>ICICI Login Completed</title></head>
      <body>
        <h3>ICICI Login Successful</h3>
        <p>Processing apisession…</p>

        <script>
          const apisession = "${apiSession}";
          if (window.opener) {
            window.opener.postMessage(
              { type: "ICICI_LOGIN", apisession },
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
