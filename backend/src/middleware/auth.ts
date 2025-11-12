// backend/src/middleware/auth.ts
import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

/**
 * authenticateToken
 * - Tries backend JWT (JWT_SECRET) first.
 * - If that fails, and SUPABASE_JWT_SECRET exists, tries that.
 * - Normalizes multiple payload shapes (userId, sub, id).
 * - Returns 401 when missing, 403 when invalid/expired, 500 when misconfigured.
 */
export const authenticateToken = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = (req.headers["authorization"] as string) || req.headers["Authorization"] as string;
    const token = authHeader && authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : authHeader; // tolerate raw token too

    if (!token) {
      return res.status(401).json({ error: "Authorization token missing" });
    }

    // Load secrets (trim to avoid accidental surrounding quotes)
    const jwtSecret = (process.env.JWT_SECRET || "").replace(/^"+|"+$/g, "").trim();
    const supabaseJwtSecret = (process.env.SUPABASE_JWT_SECRET || "").replace(/^"+|"+$/g, "").trim();

    if (!jwtSecret && !supabaseJwtSecret) {
      console.error("❌ Missing JWT secret configuration (JWT_SECRET or SUPABASE_JWT_SECRET)");
      return res.status(500).json({ error: "Server misconfiguration" });
    }

    let decoded: JwtPayload | null = null;
    // Try backend-secret first (most likely)
    if (jwtSecret) {
      try {
        decoded = jwt.verify(token, jwtSecret) as JwtPayload;
      } catch (err) {
        // ignore here and fall back to supabase secret if present
        decoded = null;
      }
    }

    // Try Supabase secret if backend verify failed
    if (!decoded && supabaseJwtSecret) {
      try {
        decoded = jwt.verify(token, supabaseJwtSecret) as JwtPayload;
      } catch (err) {
        console.error("❌ Token verification failed for both backend and Supabase:", (err as Error).message);
        return res.status(403).json({ error: "Invalid or expired token" });
      }
    }

    if (!decoded) {
      // If we still don't have a decoded payload, token wasn't valid
      return res.status(403).json({ error: "Invalid or expired token" });
    }

    // Support multiple possible payload keys
    // Check common fields used in your codebase and Supabase / generic JWTs
    // - backend generateToken likely stores { userId, email }
    // - Supabase JWTs often have 'sub' for user id and 'email' for email
    const anyDecoded = decoded as any;
    const userId = anyDecoded.userId || anyDecoded.user_id || anyDecoded.sub || anyDecoded.id;
    const email = anyDecoded.email || anyDecoded.user_email || anyDecoded.email_id || "";

    if (!userId) {
      console.error("❌ Invalid JWT payload — missing user id:", decoded);
      return res.status(403).json({ error: "Invalid token payload" });
    }

    req.user = { id: String(userId), email: String(email || "") };
    next();
  } catch (error: any) {
    console.error("❌ JWT verification failed (unexpected):", error?.message || error);
    return res.status(403).json({ error: "Invalid or expired token" });
  }
};
