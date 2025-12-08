// backend/src/middleware/checkIciciSession.ts
import { Request, Response, NextFunction } from "express";
import { query } from "../config/database.js";
import { decryptJSON } from "../utils/credentialEncryptor.js";
import debug from "debug";

const log = debug("apex:icici:session");

export async function checkIciciSession(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = (req as any).user;
    if (!user?.userId) {
      return res.status(401).json({ error: "AUTH_REQUIRED" });
    }

    const r = await query(
      `
      SELECT icici_credentials 
      FROM user_credentials
      WHERE user_id = $1 AND broker_name = 'icici'
      `,
      [user.userId]
    );

    if (!r.rows.length || !r.rows[0].icici_credentials) {
      log("❌ No ICICI credentials for user:", user.userId);
      return res.status(403).json({
        error: "ICICI_SESSION_MISSING",
        message: "ICICI Direct account is not connected.",
      });
    }

    const creds = decryptJSON(r.rows[0].icici_credentials);
    const expiresAt = creds?.expires_at;

    if (!expiresAt) {
      // Some sessions don't provide expiry — consider them valid
      return next();
    }

    const now = Date.now();
    const expiryMs = new Date(expiresAt).getTime();

    if (expiryMs <= now) {
      log("⛔ ICICI session expired for user:", user.userId);
      return res.status(440).json({
        error: "ICICI_SESSION_EXPIRED",
        message: "Your ICICI Direct session has expired. Please reconnect.",
      });
    }

    return next();
  } catch (err) {
    console.error("checkIciciSession error:", err);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
}
