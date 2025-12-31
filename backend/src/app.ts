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

import iciciAuthLoginRouter from "./routes/icici/authLogin.js";
import iciciAuthCallbackRouter from "./routes/icici/authCallback.js";

import { loginLimiter, apiLimiter } from "./middleware/rateLimiter.js";
import { authenticateToken } from "./middleware/auth.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { requestLogger } from "./middleware/logger.js";

// === Route Imports ===
import authRouter from "./routes/auth.js";
import iciciOrderRouter from "./routes/icici/orders.js";
import { iciciBrokerRouter } from "./routes/iciciBroker.js";
import { iciciStatusRouter } from "./routes/iciciStatus.js";
import { iciciStreamRouter } from "./routes/icici/stream.js";
import { strategyRouter as strategiesRouter } from "./routes/strategies.js";
import { watchlistRouter } from "./routes/watchlist.js";
import { credentialsRouter } from "./routes/credentials.js";
import { aiRouter } from "./routes/ai.js";
import redisDevRouter from "./routes/redis.js";
import profileRouter from "./routes/profile.js";

const app = express();
app.set("trust proxy", 1);

// === Security Middleware ===
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(requestLogger);

// === Health Check ===
app.get("/health", (_req, res) =>
  res.status(200).json({
    status: "OK",
    service: "alphaforge-api",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "production",
  })
);

// =======================================================
// AUTH ROUTES
// =======================================================
app.use("/api/auth", authRouter);
app.use("/api/auth/register", loginLimiter);

// =======================================================
// ICICI AUTH ROUTES (⚠️ MUST BE JWT-FREE)
// =======================================================
app.use("/api/icici/auth", iciciAuthLoginRouter);
app.use("/api/icici/auth", iciciAuthCallbackRouter);


// =======================================================
// JWT-PROTECTED ROUTES
// =======================================================
app.use("/api/credentials", authenticateToken, credentialsRouter);
app.use("/api/strategies", authenticateToken, strategiesRouter);
app.use("/api/watchlist", authenticateToken, watchlistRouter);
app.use("/api/ai", authenticateToken, aiRouter);
app.use("/api/profile", authenticateToken, profileRouter);
app.use("/api/redis", redisDevRouter);

// =======================================================
// ICICI PROTECTED ROUTES (JWT REQUIRED)
// =======================================================
app.use("/api/icici/broker", authenticateToken, iciciBrokerRouter);
app.use("/api/icici/status", authenticateToken, iciciStatusRouter);
app.use("/api/icici/stream", authenticateToken, iciciStreamRouter);
app.use("/api/icici", authenticateToken, iciciOrderRouter);

// === Global Error Handler ===
app.use(errorHandler);
// =======================================================
// GENERIC API RATE LIMITER (AFTER AUTH CALLBACK)
// =======================================================
app.use("/api", apiLimiter);

export default app;
