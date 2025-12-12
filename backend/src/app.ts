// backend/src/app.ts
import dotenv from "dotenv";
dotenv.config({ path: "/var/www/apex-algo-adept/backend/.env" });

import express from "express";
import helmet from "helmet";
import compression from "compression";

import { requestLogger } from "./middleware/logger.js";
import { errorHandler } from "./middleware/errorHandler.js";

// Core Routers
import authRouter from "./routes/auth.js";
import { strategyRouter } from "./routes/strategies.js";
import { credentialsRouter } from "./routes/credentials.js";
import { watchlistRouter } from "./routes/watchlist.js";
import { loginLimiter, apiLimiter } from "./middleware/rateLimiter.js";
import { apiLimiter, authLimiter } from "./middleware/rateLimiter.js";

// -----------------------------------------------------------
// ICICI ROUTERS (CLEANED + CORRECT)
// -----------------------------------------------------------
import { iciciAuthRouter } from "./routes/iciciAuth.js";               // /api/icici/auth/*
import { iciciOrderRoutes } from "./routes/icici/orders.js";          // /api/icici/orders/*
import { iciciStreamRouter } from "./routes/icici/stream.js";         // /api/icici/stream/*
import { iciciStatusRouter } from "./routes/iciciStatus.js";          // /api/icici/status
import { iciciBrokerRouter } from "./routes/iciciBroker.js";          // /api/icici/broker
import { iciciBacktestRouter } from "./routes/iciciBacktest.js";      // /api/icici/backtest
// (REMOVE unused authLogin/authCallback routers)

const app = express();

// Security, compression, parsers
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(requestLogger);

// Health check
app.get("/health", (_req, res) =>
  res.status(200).json({
    status: "OK",
    service: "alphaforge-api",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })
);

// -----------------------------------------------------------
// CORE API
// -----------------------------------------------------------
app.use("/api/auth", authRouter);
app.use("/api/strategies", strategyRouter);
app.use("/api/credentials", credentialsRouter);
app.use("/api/watchlist", watchlistRouter);

// Apply globally or selectively
app.use("/api/", apiLimiter);                           // 100 req/min for all API
app.use("/api/icici/auth/complete", loginLimiter);      // 10 attempts per 15 min for ICICI login
app.use("/api/auth/login", loginLimiter);               // also protect your own login
/ Auth routes with stricter limiter
app.use("/api/auth", authLimiter, authRouter);

// -----------------------------------------------------------
// ICICI DIRECT API STACK (FINAL + CORRECT)
// -----------------------------------------------------------

// 🔥 This router contains:
// GET /api/icici/auth/login         → opens ICICI login page
// POST /api/icici/auth/callback     → receives apisession
app.use("/api/icici", iciciAuthRouter);

// Save API key/secret + apisession (optional storage)
app.use("/api/icici/broker", iciciBrokerRouter);

// Status checking
app.use("/api/icici/status", iciciStatusRouter);

// Backtesting
app.use("/api/icici/backtest", iciciBacktestRouter);

// WebSocket streaming (Breeze WS wrap)
app.use("/api/icici/stream", iciciStreamRouter);

// Orders engine
app.use("/api/icici", iciciOrderRoutes);

// -----------------------------------------------------------
// GLOBAL ERROR HANDLER
// -----------------------------------------------------------
app.use(errorHandler);
//app.post("/api/icici/auth/complete", loginLimiter, iciciAuthCallbackRouter);

export default app;
