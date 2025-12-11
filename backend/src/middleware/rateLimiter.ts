// src/middleware/rateLimiter.ts
import rateLimit from "express-rate-limit";

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many login attempts, try again later" },
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
});
