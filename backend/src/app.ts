// backend/src/app.ts
/**
 * AlphaForge Backend - Secure & Performant Express Configuration
 * 
 * Key Features:
 * - Customized Helmet for balanced security (CSP delegated to Nginx for precision)
 * - Health check endpoint for PM2/Nginx/DigitalOcean monitoring
 * - Rate limiting, JWT auth, Redis-cached sessions
 * - Optimized for ICICI Breeze real-time streaming and order execution
 * 
 * CORS & primary CSP handled at Nginx level → no cors() middleware
 */

import dotenv from "dotenv";
dotenv.config({ path: "/var/www/apex-algo-adept/backend/.env" });

import express from "express";
import helmet from "helmet";
import compression from "compression";
import { loginLimiter, apiLimiter, authLimiter } from "./middleware/rateLimiter.js";
import { authenticateToken } from "./middleware/auth.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { requestLogger } from "./middleware/logger.js";

// === Route Imports (matching actual exports) ===
import authRouter from "./routes/auth.js";
import iciciOrderRouter from "./routes/icici/orders.js";
import { iciciAuthRouter } from "./routes/iciciAuth.js";
import { iciciBrokerRouter } from "./routes/iciciBroker.js";
import { iciciStatusRouter } from "./routes/iciciStatus.js";
import { iciciStreamRouter } from "./routes/icici/stream.js";
import { strategyRouter as strategiesRouter } from "./routes/strategies.js";
import { watchlistRouter } from "./routes/watchlist.js";
import { credentialsRouter } from "./routes/credentials.js";
import { aiRouter } from "./routes/ai.js";
import redisDevRouter from "./routes/redis.js"; // Default export from redis.js

const app = express();
app.set("trust proxy", 1);


// === Security Middleware ===
app.use(
  helmet({
    // Primary CSP is defined in Nginx (more precise control over 'unsafe-inline' for React)
    contentSecurityPolicy: false,
    // Allows embedding in cross-origin contexts if needed (e.g., future iframe integrations)
    crossOriginEmbedderPolicy: false,
    // Permits cross-origin resource loading (safe with JWT auth + Nginx origin restriction)
    crossOriginResourcePolicy: { policy: "cross-origin" },
    // Keep other defaults: HSTS (reinforced by Nginx), X-Frame-Options, etc.
  })
);

app.use(compression()); // Fallback; primary Brotli/Gzip via Nginx
app.use(express.json({ limit: "10mb" }));
app.use(requestLogger);

// === Health Check Endpoint (Public - No Auth) ===
app.get("/health", (_req, res) =>
  res.status(200).json({
    status: "OK",
    service: "alphaforge-api",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "production",
    version: process.env.npm_package_version || "1.0.0",
  })
);

// === Rate Limiting ===
app.use("/api/auth/login", loginLimiter);
app.use("/api/auth/register", loginLimiter);
app.use("/api", apiLimiter);


// === Route Mounting ===
app.use("/api/auth", authRouter);

app.use("/api/credentials", authenticateToken, credentialsRouter);
app.use("/api/strategies", authenticateToken, strategiesRouter);
app.use("/api/watchlist", authenticateToken, watchlistRouter);
app.use("/api/ai", authenticateToken, aiRouter);
app.use("/api/redis", redisDevRouter); // Dev-only

// ICICI Breeze Protected Routes
app.use("/api/icici/broker", authenticateToken, iciciBrokerRouter);
app.use("/api/icici/status", authenticateToken, iciciStatusRouter);
app.use("/api/icici/stream", authenticateToken, iciciStreamRouter);
app.use("/api/icici", iciciAuthRouter);
app.use("/api/icici", authenticateToken, iciciOrderRouter);

// === Global Error Handler ===
app.use(errorHandler);

export default app;
