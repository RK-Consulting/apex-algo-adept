// backend/src/routes/icici/authCallback.ts
import { Router } from "express";

const router = Router();

/**
 * ICICI Breeze R50 callback
 * Expected ICICI redirect formats:
 *   ?apisession=XXXX         (main R50 format)
 *   ?session_token=XXXX      (fallback)
 *   ?code=XXXX               (rare fallback)
 */
router.get("/auth/callback", async (req, res) => {
  // 🔥 Unified token extraction
  const sessionFromICICI =
    req.query.apisession ||      // primary ICICI param
    req.query.session_token ||   // fallback
    req.query.code ||            // fallback
    "";

  if (!sessionFromICICI) {
    return res.send("<h3>Missing apisession / session_token from ICICI</h3>");
  }

  return res.send(`
    <html>
      <body>
        <h3>ICICI Login Successful</h3>
        <p>Processing session token…</p>

        <script>
          const token = "${sessionFromICICI}";
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

