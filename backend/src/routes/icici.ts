// backend/src/routes/icici.ts
import { Router } from "express";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import breezeSession from "../utils/breezeSession.js";
import { query } from "../config/database.js";

const router = Router();

/**
 * POST /api/icici/connect
 * Returns a loginUrl for the frontend to open so user can authorize Breeze
 */
router.post("/connect", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;
    const sessionInfo = await breezeSession.createBreezeLoginSession(userId);
    return res.json({ success: true, loginUrl: sessionInfo.loginUrl, state: sessionInfo.state });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/icici/auth/callback
 * OAuth redirect callback. ICICI will redirect here with code & state.
 * This endpoint expects query params ?code=...&state=...
 *
 * This route will exchange code and save session tied to the user id extracted from state.
 * If you do not encode userId into state for security reasons, you can map state<->user on DB.
 */
router.get("/auth/callback", async (req, res, next) => {
  try {
    const { code, state } = req.query as Record<string, string>;
    if (!code) return res.status(400).send("Missing code");

    // If you included userId in state, extract it. Here we used format `${userId}:${nonce}`
    let userId: string | null = null;
    if (state && state.includes(":")) {
      userId = state.split(":")[0];
    }

    // If you used a DB mapping for states, you can lookup here.
    if (!userId) {
      // Try DB lookup (icici_oauth_states)
      const sres = await query(`SELECT user_id FROM icici_oauth_states WHERE state = $1 LIMIT 1`, [state]);
      if (sres.rows.length) userId = sres.rows[0].user_id;
    }

    if (!userId) {
      return res.status(400).send("Invalid state - cannot map to user");
    }

    // Exchange code for tokens and persist
    const session = await breezeSession.handleAuthCallback(userId, code);

    // Option A: redirect to frontend success page
    const frontendRedirect = process.env.FRONTEND_URL || process.env.VITE_BACKEND_URL || "https://alphaforge.skillsifter.in";
    return res.redirect(`${frontendRedirect}/icici-connected?success=true`);
  } catch (err) {
    console.error("ICICI auth callback error:", err);
    return res.status(500).send("ICICI auth callback error");
  }
});

/**
 * POST /api/icici/me
 * Returns current account info by proxying to Breeze using stored token
 */
router.post("/me", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;
    let session = await breezeSession.getSessionForUser(userId);
    if (!session) return res.status(404).json({ success: false, error: "No ICICI session" });

    // If expired, try refresh
    if (session.expires_at && new Date(session.expires_at).getTime() < Date.now()) {
      try {
        session = await breezeSession.refreshSessionForUser(userId);
      } catch (e) {
        // continue with failure
        console.warn("Failed to refresh session:", e);
      }
    }

    const meUrl = `${process.env.ICICI_BREEZE_API_BASE || "https://breeze-api.icicidirect.com"}/v1/user/me`; // TODO: replace with actual endpoint
    const fetchRes = await fetch(meUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        Accept: "application/json",
      },
    });

    const payload = await fetchRes.json().catch(() => ({}));
    return res.json({ success: true, data: payload });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/icici/orders
 * Proxy endpoint to place or list orders (method controlled by payload)
 */
router.post("/orders", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;
    const { endpointPath, method = "GET", payload = {} } = req.body;

    if (!endpointPath) return res.status(400).json({ success: false, error: "Missing endpointPath in body" });

    let session = await breezeSession.getSessionForUser(userId);
    if (!session) return res.status(404).json({ success: false, error: "No ICICI session" });

    // refresh if expired
    if (session.expires_at && new Date(session.expires_at).getTime() < Date.now()) {
      session = await breezeSession.refreshSessionForUser(userId).catch(() => session);
    }

    const url = `${process.env.ICICI_BREEZE_API_BASE || "https://breeze-api.icicidirect.com"}${endpointPath}`;
    const fetchRes = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: method !== "GET" && method !== "HEAD" ? JSON.stringify(payload) : undefined,
    });

    const json = await fetchRes.json().catch(() => ({}));
    if (!fetchRes.ok) {
      return res.status(fetchRes.status).json({ success: false, error: json || fetchRes.statusText });
    }
    return res.json({ success: true, data: json });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/icici/portfolio
 * Proxy: query portfolio endpoint
 */
router.post("/portfolio", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;
    let session = await breezeSession.getSessionForUser(userId);
    if (!session) return res.status(404).json({ success: false, error: "No ICICI session" });

    if (session.expires_at && new Date(session.expires_at).getTime() < Date.now()) {
      session = await breezeSession.refreshSessionForUser(userId).catch(() => session);
    }

    const url = `${process.env.ICICI_BREEZE_API_BASE || "https://breeze-api.icicidirect.com"}/v1/portfolio`; // TODO: adjust path
    const fetchRes = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${session.access_token}`, Accept: "application/json" },
    });

    const json = await fetchRes.json().catch(() => ({}));
    return res.json({ success: true, data: json });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/icici/status
 * Returns a simple status for ICICI connection (present/absent, expiry)
 */
router.post("/status", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;
    const session = await breezeSession.getSessionForUser(userId);
    if (!session) return res.json({ success: true, connected: false });

    const expiresAt = session.expires_at ? new Date(session.expires_at).toISOString() : null;
    return res.json({ success: true, connected: true, expires_at: expiresAt });
  } catch (err) {
    next(err);
  }
});

export { router as iciciRouter };
