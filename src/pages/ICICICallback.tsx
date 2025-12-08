import { useEffect } from "react";
import { ICICI } from "@/lib/api";

export default function ICICICallback() {
  useEffect(() => {
    const url = new URL(window.location.href);
    const apiSession = url.searchParams.get("apisession");

    if (!apiSession) {
      console.error("Missing apisession in URL");
      return;
    }

    // Send apisession to backend (server will fetch session_token)
    ICICI.callback({ apisession: apiSession })
      .then((res) => {
        if (window.opener) {
          window.opener.postMessage(
            {
              type: "ICICI_LOGIN_SUCCESS",
              session_token: res.session_token, // returned from backend
              icici_user: res.icici_user,
            },
            "*"
          );
          window.close();
        }
      })
      .catch((err) => {
        console.error("ICICI callback failed:", err);
        if (window.opener) {
          window.opener.postMessage(
            {
              type: "ICICI_LOGIN_ERROR",
              error: err?.message || "Login failed",
            },
            "*"
          );
        }
      });
  }, []);

  return (
    <div style={{ padding: "2rem", fontSize: "1.2rem" }}>
      <h2>Logging in to ICICI…</h2>
      <p>Please wait. This window will close automatically.</p>
    </div>
  );
}
