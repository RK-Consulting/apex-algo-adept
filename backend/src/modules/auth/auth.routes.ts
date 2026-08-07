// backend/src/routes/auth.ts
/**
 * Verify JWT Token
 *
 * This endpoint returns a normalized payload that matches the middleware's
 * normalization (userId + email). Use authenticateToken when you want a route
 * that both verifies the token AND provides req.user to route handlers.
 *
 * Clients call this endpoint after login to confirm token validity and to read
 * the canonical userId the backend uses everywhere.
 */

import express from "express";
import { loginUser, registerUser } from "./auth.controller.js";
import jwt from "jsonwebtoken";
import { query } from "../../config/database.js"; // Added for connection status check

const router = express.Router();

router.post("/login", loginUser);
router.post("/register", registerUser);

/**
 * Verify JWT Token + ICICI Session Status
 * Normalized to return userId and current Broker State for the Aggregator Dashboard.
 */
router.get("/verify", async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1];
  const secret = process.env.JWT_SECRET || "fallback-secret-change-in-prod";

  try {
    const decoded = jwt.verify(token, secret) as {
      userId?: string;
      id?: string;
      sub?: string;
      email?: string;
    };

    const userId = decoded.userId || decoded.id || decoded.sub || null;
    const email = decoded.email || "";

    if (!userId) {
      return res.status(401).json({ error: "Invalid token payload" });
    }

    /* ======================================================
        AGGREGATOR ADDITION: Check ICICI Connection Status
       ====================================================== */
    const fsmStatus = await query(
      `SELECT state FROM icici_login_attempts WHERE user_id = $1::uuid`,
      [userId]
    );

    const brokerConnected = fsmStatus.rows[0]?.state === 'SESSION_ACTIVE';

    return res.json({
      valid: true,
      user: {
        userId,
        email,
        brokerConnected, // Frontend uses this to show/hide "Connect ICICI" button
        brokerState: fsmStatus.rows[0]?.state || 'IDLE'
      },
    });
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
});

export default router;
