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
 * Middleware: verifies JWT tokens from either:
 *  - AlphaForge backend (JWT_SECRET)
 *  - Supabase Auth (SUPABASE_JWT_SECRET)
 */
export const authenticateToken = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Authorization token missing" });

    const backendSecret = process.env.JWT_SECRET;
    const supabaseSecret = process.env.SUPABASE_JWT_SECRET;
    if (!backendSecret && !supabaseSecret)
      return res.status(500).json({ error: "Server misconfiguration" });

    let decoded: JwtPayload | null = null;

    // Try backend JWT first, then Supabase
    try {
      decoded = jwt.verify(token, backendSecret!) as JwtPayload;
    } catch {
      if (supabaseSecret) {
        try {
          decoded = jwt.verify(token, supabaseSecret) as JwtPayload;
        } catch (err2: any) {
          console.error("❌ Token verification failed:", err2.message);
          return res.status(403).json({ error: "Invalid or expired token" });
        }
      } else {
        return res.status(403).json({ error: "Invalid or expired token" });
      }
    }

    if (!decoded)
      return res.status(403).json({ error: "Invalid or expired token" });

    // Normalize user payload fields
    const userId = decoded.sub || decoded.userId || decoded.id;
    const email = decoded.email || decoded.user_email || "";

    if (!userId)
      return res.status(403).json({ error: "Invalid token payload" });

    req.user = { id: userId.toString(), email };
    next();
  } catch (err: any) {
    console.error("❌ JWT verification failed:", err.message);
    res.status(403).json({ error: "Invalid or expired token" });
  }
};

