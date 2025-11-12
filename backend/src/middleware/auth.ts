// backend/src/middleware/auth.ts
import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

export const authenticateToken = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({ error: "Authorization token missing" });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error("❌ Missing JWT_SECRET in environment");
      return res.status(500).json({ error: "Server misconfiguration" });
    }

    const decoded = jwt.verify(token, secret) as JwtPayload;
    const userId = decoded.userId || decoded.id || decoded.sub;
    const email = decoded.email || "";

    if (!userId) {
      return res.status(403).json({ error: "Invalid token payload" });
    }

    req.user = { id: userId.toString(), email };
    next();
  } catch (err: any) {
    console.error("❌ JWT verification failed:", err.message);
    return res.status(403).json({ error: "Invalid or expired token" });
  }
};
