// backend/src/middleware/rateLimiter.ts
import rateLimit from "express-rate-limit";

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per IP
  //standardHeaders: true,
  //legacyHeaders: false,
  message: { error: "Too many requests — slow down!" },
});

// For sensitive routes like auth
export const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 hour
  max: 100,
  message: { error: "Too many auth attempts — try ." },
});

// Extra-strict limiter just for ICICI callback & login endpoints
export const iciciLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,                         // only 5 attempts per 15 min
  message: { error: "Too many ICICI login attempts — your IP may get blocked!" },
});
