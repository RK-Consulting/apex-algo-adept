//backend/src/routes/iciciAuth.ts

import express, { Request, Response } from "express";
import axios from "axios";
import crypto from "crypto";
import { Pool } from "pg";

const router = express.Router();

const {
  ICICI_APP_KEY,
  ICICI_SECRET_KEY,
  ICICI_REDIRECT_URL,
  DATABASE_URL,
} = process.env;

if (!ICICI_APP_KEY || !ICICI_SECRET_KEY || !ICICI_REDIRECT_URL) {
  console.warn("⚠️ ICICI configuration missing in environment variables");
}

const pool = new Pool({
  connectionString: DATABASE_URL,
});

// ------------------------------
// Helpers
// ------------------------------

function getTimestampUTC(): string {
  const iso = new Date().toISOString();
  return iso.slice(0, 19) + ".000Z";
}

function computeChecksum(timestamp: string, body: string, secretKey: string): string {
  const raw = timestamp + body + secretKey;
  return crypto.createHash("sha256").update(raw, "utf8").digest("hex");
}

// ------------------------------
// 1) Redirect to ICICI Breeze Login
// ------------------------------
router.get("/login", (req: Request, res: Response) => {
  const url =
    "https://api.icicidirect.com/apiuser/login?api_key=" +
    encodeURIComponent(ICICI_APP_KEY!);

  return res.redirect(url);
});

// ------------------------------
// 2) Callback after login
// /api/icici/auth/callback?apisession=XXXXX
// ------------------------------
router.get("/callback", async (req: Request, res: Response) => {
  try {
    const apiSession =
      req.query.apisession ||
      req.query.API_Session ||
      req.query.session ||
      null;

    if (!apiSession) {
      return res.status(400).json({ error: "Missing apisession from ICICI redirect" });
    }

    const customerDetailsUrl =
      "https://api.icicidirect.com/breezeapi/api/v1/customerdetails";

    const payload = {
      SessionToken: String(apiSession),
      AppKey: ICICI_APP_KEY!,
    };

    // CustomerDetails DOES NOT require headers (per docs)
    const cdResp = await axios.get(customerDetailsUrl, {
      headers: { "Content-Type": "application/json" },
      data: JSON.stringify(payload),
      timeout: 15000,
    });

    const data = cdResp.data;

    if (!data?.Success?.session_token) {
      return res.status(502).json({
        error: "CustomerDetails did not return session_token",
        detail: data,
      });
    }

    const sessionToken = data.Success.session_token;
    const idirectUserId = data.Success.idirect_userid ?? null;
    const idirectUserName = data.Success.idirect_user_name ?? null;

    // Store in DB
    const client = await pool.connect();
    try {
      const insertSQL = `
        INSERT INTO icici_sessions (idirect_userid, session_token, username)
        VALUES ($1, $2, $3)
        RETURNING id, created_at
      `;
      const result = await client.query(insertSQL, [
        idirectUserId,
        sessionToken,
        idirectUserName,
      ]);

      return res.json({
        ok: true,
        message: "session_token stored",
        record: result.rows[0],
        preview: sessionToken.slice(0, 6) + "...",
      });
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error("ICICI callback error:", err.response?.data || err.message);
    return res.status(500).json({
      error: "Error exchanging API_Session",
      detail: err.response?.data || err.message,
    });
  }
});

// ------------------------------
// 3) Example Authenticated API Call (Demat Holdings)
// ------------------------------
router.get("/demat/:id", async (req: Request, res: Response) => {
  const sessionRecordId = req.params.id;

  const client = await pool.connect();
  try {
    const result = await client.query(
      "SELECT session_token FROM icici_sessions WHERE id = $1",
      [sessionRecordId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Session not found" });
    }

    const sessionToken: string = result.rows[0].session_token;

    const url = "https://api.icicidirect.com/breezeapi/api/v1/dematholdings";
    const payload = {};
    const payloadStr = JSON.stringify(payload);

    const timestamp = getTimestampUTC();
    const checksum = computeChecksum(timestamp, payloadStr, ICICI_SECRET_KEY!);

    const headers = {
      "Content-Type": "application/json",
      "X-Checksum": "token " + checksum,
      "X-Timestamp": timestamp,
      "X-AppKey": ICICI_APP_KEY!,
      "X-SessionToken": sessionToken,
    };

    const response = await axios.get(url, {
      headers,
      data: payloadStr,
      timeout: 15000,
    });

    return res.json({
      ok: true,
      data: response.data,
    });
  } catch (err: any) {
    console.error("Demat error:", err.response?.data || err.message);
    return res.status(500).json({
      error: "Failed to fetch demat holdings",
      detail: err.response?.data || err.message,
    });
  } finally {
    client.release();
  }
});

export default router;
