// backend/src/middleware/auth.ts
import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import debug from "debug";

const log = debug("apex:auth");

/**
 * Extended Request with authenticated user
 * Normalized to userId (string) for consistency across AlphaForge backend
 */
export interface AuthRequest extends Request {
  user?: {
    userId: string; // Normalized from userId / id / sub
    email: string;
  };
}

/**
 * JWT Authentication Middleware
 *
 * - Supports Bearer token in Authorization header
 * - Flexible payload parsing (userId / id / sub)
 * - Normalizes to req.user.userId
 * - Secure secret handling (trims quotes from .env)
 * - Comprehensive logging for debugging in PM2
 *
 * Note: Return type intentionally omitted — Express middleware allows early res.send()
 */
export const authenticateToken = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader =
    (req.headers["authorization"] as string) ||
    (req.headers["Authorization"] as string);

  if (!authHeader) {
    return res.status(401).json({ error: "Authorization token missing" });
  }

  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader;

  if (!token) {
    return res.status(401).json({ error: "Authorization token missing" });
  }

  const rawSecret = process.env.JWT_SECRET || "";
  const jwtSecret = rawSecret.replace(/^"+|"+$/g, "").trim();

  if (!jwtSecret) {
    console.error("❌ JWT_SECRET missing in environment");
    return res.status(500).json({ error: "Server configuration error" });
  }

  try {
    const decoded = jwt.verify(token, jwtSecret) as JwtPayload;
    const anyDecoded = decoded as any;

    // Flexible key support for future compatibility
    const userId =
      anyDecoded.userId ||
      anyDecoded.id ||
      anyDecoded.sub;

    const email =
      anyDecoded.email ||
      anyDecoded.user_email ||
      "";

    if (!userId) {
      log("❌ JWT payload missing user identifier:", decoded);
      return res.status(403).json({ error: "Invalid token payload" });
    }

    // Normalize for consistent usage across all routes/services
    req.user = {
      userId: String(userId),
      email: String(email),
    };

    return next();
  } catch (err: any) {
    log("❌ JWT verification failed:", err?.message);
    return res.status(403).json({ error: "Unauthorized" });
  }
};
