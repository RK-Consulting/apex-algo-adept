// backend/src/routes/icici/authCallback.ts
import { Router } from "express";
import axios from "axios";

const router = Router();

router.get("/auth/callback", async (req, res) => {
  try {
    const apiSession = req.query.apisession;

    if (!apiSession) {
      return res.send("<h3>Missing apisession from ICICI</h3>");
    }

    // 1) Exchange API_Session → session_token
    const customerDetailsUrl =
      "https://api.icicidirect.com/breezeapi/api/v1/customerdetails";

    const payload = {
      SessionToken: String(apiSession),
      AppKey: process.env.ICICI_APP_KEY!,
    };

    const cdResp = await axios.get(customerDetailsUrl, {
      headers: { "Content-Type": "application/json" },
      data: JSON.stringify(payload),
    });

    const sessionToken = cdResp.data?.Success?.session_token;

    if (!sessionToken) {
      return res.send("<h3>ICICI error: No session_token returned.</h3>");
    }

    // 2) Store the final session_token in DB
    // NOTE: In real code, use Postgres insert here
    // For now just send session_token to frontend
    // (but ideally you store it server-side)
    const safeToken = sessionToken.replace(/"/g, "&quot;");

    return res.send(`
      <html>
        <body>
          <h3>ICICI Login Successful</h3>
          <p>Session Token Received.</p>

          <script>
            const session_token = "${safeToken}";
            if (window.opener) {
              window.opener.postMessage(
                { type: "ICICI_LOGIN", session_token },
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
  } catch (err: any) {
    console.error("ICICI callback error:", err.message);
    return res.send("<h3>Error exchanging ICICI API session</h3>");
  }
});

export { router as iciciAuthCallbackRouter };
