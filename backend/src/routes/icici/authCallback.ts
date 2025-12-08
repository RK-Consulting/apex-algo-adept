// backend/src/routes/icici/authCallback.ts
import { Router } from "express";
import axios from "axios";
import { query } from "../../config/database.js";
import { authenticateToken, AuthRequest } from "../../middleware/auth.js";

const router = Router();

/**
 * POST /api/icici/auth/callback
 * Body:
 *   { apisession: string }
 */
router.post("/auth/callback", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { apisession } = req.body;
    const userId = req.user!.userId;

    if (!apisession) {
      return res.status(400).json({ error: "Missing apisession" });
    }

    const payload = {
      SessionToken: String(apisession),
      AppKey: process.env.ICICI_APP_KEY!,
    };

    // Call ICICI CustomerDetails API
    const cdResp = await axios.get(
      "https://api.icicidirect.com/breezeapi/api/v1/customerdetails",
      {
        headers: { "Content-Type": "application/json" },
        data: JSON.stringify(payload),
      }
    );

    const data = cdResp.data;

    if (!data?.Success?.session_token) {
      return res.status(500).json({
        error: "ICICI did not return session_token",
        detail: data,
      });
    }

    const sessionToken = data.Success.session_token;
    const idirect_userid = data.Success.idirect_userid || null;
    const idirect_user_name = data.Success.idirect_user_name || null;

    // Store ICICI session token in Postgres
    const insert = await query(
      `
      INSERT INTO icici_sessions (user_id, session_token, idirect_userid, idirect_user_name)
      VALUES ($1, $2, $3, $4)
      RETURNING id, created_at
      `,
      [userId, sessionToken, idirect_userid, idirect_user_name]
    );

    return res.json({
      success: true,
      session_token: sessionToken,
      icici_user: {
        idirect_userid,
        idirect_user_name,
      },
      session_record: insert.rows[0],
    });
  } catch (err: any) {
    console.error("ICICI callback error:", err.response?.data || err.message);
    return res.status(500).json({
      error: "Failed to complete ICICI login",
      detail: err.response?.data || err.message,
    });
  }
});

export const iciciAuthCallbackRouter = router;
