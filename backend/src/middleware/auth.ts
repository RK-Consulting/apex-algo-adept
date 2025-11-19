// backend/src/middleware/auth.ts
import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import debug from "debug";

const log = debug("apex:auth");

export interface AuthRequest extends Request {
  user?: {
    userId: string;   // ✅ CHANGED (was id)
    email: string;
  };
}

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

    // Accept multiple possible keys
    const userId =
      anyDecoded.userId ||
      anyDecoded.id ||
      anyDecoded.sub;

    const email =
      anyDecoded.email ||
      anyDecoded.user_email ||
      "";

    if (!userId) {
      log("❌ JWT payload missing userId:", decoded);
      return res.status(403).json({ error: "Invalid token payload" });
    }

    // ✅ NORMALIZE TO userId (NOT id!)
    req.user = {
      userId: String(userId),
      email: String(email || ""),
    };

    return next();
  } catch (err: any) {
    log("❌ JWT verification failed:", err?.message);
    return res.status(403).json({ error: "Unauthorized" });
  }
};
