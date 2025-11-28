// backend/src/routes/icici/authCallback.ts
import { Router } from "express";

const router = Router();

router.get("/auth/callback", async (req, res) => {
  const sessionFromICICI =
    req.query.session_token ||
    req.query.apisession ||
    req.query.code ||
    "";

  if (!sessionFromICICI) {
    return res.send("<h3>Missing session_token / apisession from ICICI</h3>");
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
