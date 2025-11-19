// backend/src/routes/auth.ts
import express from "express";
import { loginUser, registerUser } from "../controllers/authController.js";
import jwt from "jsonwebtoken";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";

const router = express.Router();

// Existing routes
router.post("/login", loginUser);
router.post("/register", registerUser);

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
router.get("/verify", (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1];
  const secret = process.env.JWT_SECRET || "fallback-secret-change-in-prod";

  try {
    // Verify token using the same secret used to sign it
    const decoded = jwt.verify(token, secret) as {
      userId?: string;
      id?: string;
      sub?: string;
      email?: string;
      iat?: number;
      exp?: number;
    };

    // Accept multiple possible token shapes, normalize to userId
    const userId = decoded.userId || decoded.id || decoded.sub || null;
    const email = decoded.email || "";

    if (!userId) {
      // token valid but payload missing user id — treat as invalid payload
      return res.status(401).json({ error: "Invalid token payload" });
    }

    // Return a consistent shape expected by frontend and other routes:
    // { valid: true, user: { userId, email } }
    return res.json({
      valid: true,
      user: {
        userId,
        email,
      },
    });
  } catch (err) {
    console.log("JWT verify failed:", err);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
});

export default router;
