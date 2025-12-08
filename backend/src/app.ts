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

// -----------------------------------------------------------
// Correct ICICI router imports
// -----------------------------------------------------------
import { iciciBrokerRouter } from "./routes/iciciBroker.js";
import { iciciStatusRouter } from "./routes/iciciStatus.js";
import { iciciBacktestRouter } from "./routes/iciciBacktest.js";
import { iciciStreamRouter } from "./routes/icici/stream.js";
import { iciciAuthCallbackRouter } from "./routes/icici/authCallback.js";
import { iciciAuthRouter } from "./routes/iciciAuth";

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

// Core API
app.use("/api/auth", authRouter);
app.use("/api/strategies", strategyRouter);
app.use("/api/credentials", credentialsRouter);
app.use("/api/watchlist", watchlistRouter);

// -----------------------------------------------------------
// ICICI — All new correct routes
// -----------------------------------------------------------

// Save API key/secret + apisession
app.use("/api/icici/broker", iciciBrokerRouter);

// Status checks
app.use("/api/icici/status", iciciStatusRouter);

// Backtesting
app.use("/api/icici/backtest", iciciBacktestRouter);

// WebSocket controller
app.use("/api/icici/stream", iciciStreamRouter);

// OAuth callback endpoint
app.use("/api/icici/auth", iciciAuthCallbackRouter);
app.use("/api/icici/auth", iciciAuthRouter);
// Global error handler
app.use(errorHandler);

export default app;
