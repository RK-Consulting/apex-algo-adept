// backend/src/middleware/errorHandler.ts
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

interface ApiError extends Error {
  statusCode?: number;
  code?: string;
}

/**
 * Global Error Handler
 * --------------------
 * Handles:
 *  - Breeze / ICICI errors
 *  - Database (Postgres) constraint errors
 *  - JWT failures
 *  - JSON parse errors
 *  - Uncaught exceptions
 */
export const errorHandler = (
  err: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // If headers already sent, delegate to Express
  if (res.headersSent) return next(err);

  const isDev = process.env.NODE_ENV === "development";

  // Normalize status
  let status = err.statusCode || res.statusCode || 500;
  if (status < 400) status = 500;

  /* ---------------------------------------------------------
     JWT Errors
  --------------------------------------------------------- */
  if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
    status = 403;
    err.message = "Invalid or expired authentication token";
    err.code = "AUTH_INVALID_TOKEN";
  }

  /* ---------------------------------------------------------
     JSON Syntax Errors
  --------------------------------------------------------- */
  if (err instanceof SyntaxError && "body" in err) {
    status = 400;
    err.message = "Invalid JSON in request body";
    err.code = "BAD_JSON";
  }

  /* ---------------------------------------------------------
     Postgres Constraint Errors (23xxx)
  --------------------------------------------------------- */
  const pgErr: any = err;
  if (pgErr.code?.startsWith("23")) {
    status = 400;
    err.message = "Database constraint violation";
    err.code = "DB_CONSTRAINT_ERROR";
  }

  /* ---------------------------------------------------------
     ICICI / Breeze Errors (Upstream failures)
  --------------------------------------------------------- */
  if (
    err.message?.toLowerCase().includes("breeze") ||
    err.message?.toLowerCase().includes("icici")
  ) {
    status = 502; // Bad gateway
    err.code = "ICICI_BREEZE_ERROR";
  }

  /* ---------------------------------------------------------
     Logging
  --------------------------------------------------------- */
  log("❌ Error Handler:", {
    status,
    message: err.message,
    code: err.code,
    stack: isDev ? err.stack : undefined,
  });

  if (status >= 500 && !isDev) {
    console.error("❌ Server Error:", err.message);
  }

  /* ---------------------------------------------------------
     Send Normalized Response
  --------------------------------------------------------- */
  return res.status(status).json({
    success: false,
    error: err.message || "Internal server error",
    code: err.code || "SERVER_ERROR",
    ...(isDev && { stack: err.stack }),
  });
};
