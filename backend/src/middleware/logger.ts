// backend/src/middleware/errorHandler.ts
import { Request, Response, NextFunction } from "express";
import debug from "debug";

// Debug logger (enable via DEBUG=apex:error)
const log = debug("apex:error");

interface ApiError extends Error {
  statusCode?: number;
  code?: string;
}

/**
 * Global Error Handler — production-safe & frontend-friendly
 * ---------------------------------------------------------
 * Standardizes error output for:
 *  - ICICI/Breeze failures
 *  - DB/Postgres errors
 *  - JWT errors
 *  - Validation errors
 *  - Syntax errors (invalid JSON)
 *  - Unknown exceptions
 */
export const errorHandler = (
  err: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Prevent sending headers twice
  if (res.headersSent) {
    return next(err);
  }

  const isDev = process.env.NODE_ENV === "development";

  // Default status code
  let status = err.statusCode || res.statusCode || 500;

  // Normalize status (Express sometimes leaves res.statusCode=200)
  if (status < 400) status = 500;

  /* ---------------------------------------------------------
     1. Handle common known error types
  --------------------------------------------------------- */

  // JWT token errors
  if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
    status = 403;
    err.message = "Invalid or expired authentication token";
    err.code = "AUTH_INVALID_TOKEN";
  }

  // Invalid JSON payload sent by client
  if (err instanceof SyntaxError && "body" in err) {
    status = 400;
    err.message = "Invalid JSON in request body";
    err.code = "BAD_JSON";
  }

  // Postgres errors (unique constraint, FK errors, etc.)
  const pgErr: any = err;
  if (pgErr.code?.startsWith("23")) {
    status = 400;
    err.message = "Database constraint violation";
    err.code = "DB_CONSTRAINT_ERROR";
  }

  // ICICI / Breeze API errors
  if (err.message?.includes("breeze") || err.message?.includes("ICICI")) {
    status = 502; // Bad gateway — upstream broker failure
    err.code = "ICICI_BREEZE_ERROR";
  }

  /* ---------------------------------------------------------
     2. Logging (Debug only unless fatal)
  --------------------------------------------------------- */
  log("❌ Error Handler:", {
    message: err.message,
    code: err.code,
    status,
    stack: isDev ? err.stack : undefined,
  });

  if (status >= 500 && !isDev) {
    console.error("❌ Server Error:", err.message);
  }

  /* ---------------------------------------------------------
     3. Send normalized response to frontend
  --------------------------------------------------------- */
  return res.status(status).json({
    success: false,
    error: err.message || "Internal server error",
    code: err.code || "SERVER_ERROR",
    ...(isDev && { stack: err.stack }),
  });
};
