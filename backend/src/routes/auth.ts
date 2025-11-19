// backend/src/routes/auth.ts
import express from "express";
import { loginUser, registerUser } from "../controllers/authController.js";
import jwt from "jsonwebtoken";

const router = express.Router();

// Existing routes
router.post("/login", loginUser);
router.post("/register", registerUser);

// ADD: Verify JWT Token
router.get("/verify", (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1];
  const secret = process.env.JWT_SECRET || "fallback-secret-change-in-prod";

  try {
    // Verify token (same secret used in generateToken)
    const decoded = jwt.verify(token, secret) as { userId: string; email: string; iat: number; exp: number };

    // Token is valid → return minimal user info
    res.json({
      valid: true,
      user: {
        id: decoded.userId,
        email: decoded.email,
      },
    });
  } catch (err) {
    console.log("JWT verify failed:", err);
    res.status(401).json({ error: "Invalid or expired token" });
  }
});

export default router;
