//  /src/pages/ICICICallback.tsx

import { useEffect } from "react";
import { ICICI } from "@/lib/api";

const FRONTEND_ORIGIN = window.location.origin;

export default function ICICICallback() {
  useEffect(() => {
    const url = new URL(window.location.href);
    const apisession = url.searchParams.get("apisession");

    if (!apisession) {
      postResult("ICICI_LOGIN_ERROR", "Missing apisession in callback");
      return;
    }

    // 🔐 Server-side exchange ONLY
    ICICI.callback({ apisession })
      .then(() => {
        postResult("ICICI_LOGIN_SUCCESS");
      })
      .catch((err: any) => {
        postResult(
          "ICICI_LOGIN_ERROR",
          err?.message || "ICICI login failed"
        );
      });
  }, []);

  function postResult(type: string, error?: string) {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(
        { type, error },
        FRONTEND_ORIGIN
      );
      window.close();
      return;
    }

    // Fallback: same-tab flow
    if (type === "ICICI_LOGIN_SUCCESS") {
      window.location.href = "/dashboard?icici_connected=true";
    } else {
      window.location.href =
        "/dashboard?icici_connected=false&error=" +
        encodeURIComponent(error || "Login failed");
    }
  }

  return (
    <div style={{ padding: "2rem", fontSize: "1.1rem" }}>
      <h2>Connecting to ICICI…</h2>
      <p>Please wait. This window will close automatically.</p>
    </div>
  );
}
