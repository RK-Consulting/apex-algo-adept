// backend/src/middleware/logger.ts
import { Request, Response, NextFunction } from "express";
import debug from "debug";

// Request logger namespace
const requestLog = debug("apex:request");

/**
 * Logs HTTP method, URL, and response time
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on("finish", () => {
    const ms = Date.now() - start;
    requestLog(`${req.method} ${req.originalUrl} ${res.statusCode} - ${ms}ms`);
  });

  next();
}


