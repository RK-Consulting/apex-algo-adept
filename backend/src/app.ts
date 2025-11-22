// /backend/src/app.ts
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import dotenv from "dotenv";

import { requestLogger } from "./middleware/logger.js";
import { errorHandler } from "./middleware/errorHandler.js";

// Core Routers
import authRouter from "./routes/auth.js";
import { strategyRouter } from "./routes/strategies.js";
import { credentialsRouter } from "./routes/credentials.js";

// -----------------------------------------------------------
// NEW ICICI ROUTERS (AFTER CLEANUP)
// -----------------------------------------------------------

import { iciciBrokerRouter } from "./routes/iciciBroker.js";                 // Store/Retrieve encrypted credentials + Connect
import { iciciStatusRouter } from "./routes/iciciStatus.js";                 // Connection status & session info
import { iciciBacktestRouter } from "./routes/iciciBacktest.js";             // (Kept) Backtesting endpoint
import { iciciStreamControlRouter } from "./routes/icici/streamControlRouter.js"; // WS handshake controller

// ❌ DO NOT IMPORT OLD ROUTES HERE ANYMORE
// ❌ marketDataRouter
// ❌ iciciOrdersRouter
// ❌ iciciPortfolioRouter
// ❌ iciciMeRouter
// ❌ iciciAuthCallbackRouter
// ❌ iciciStatusRouter (old one)
// ❌ iciciStreamRouter (old one)

dotenv.config();

const app = express();

/* -------------------------------------------------------
   CORS CONFIG (Cloudflare Pages + your domain)
------------------------------------------------------- */
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      const staticAllowed = [
        "http://localhost:5173",
        "http://localhost:4173",
        "https://alphaforge.skillsifter.in",
        "https://www.alphaforge.skillsifter.in",
      ];

      if (origin.endsWith(".apex-algo-adept.pages.dev"))
        return callback(null, true);

      if (staticAllowed.includes(origin)) return callback(null, true);

      console.warn("CORS Blocked:", origin);
      return callback(new Error("Not allowed by CORS"), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  })
);

app.options("*", cors());

/* -------------------------------------------------------
   Security + Compression + Parsers
------------------------------------------------------- */
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

/* -------------------------------------------------------
   Health Check
------------------------------------------------------- */
app.get("/health", (_req, res) =>
  res.status(200).json({
    status: "OK",
    service: "alphaforge-api",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })
);

/* -------------------------------------------------------
   MAIN API ROUTES
------------------------------------------------------- */
app.use("/api/auth", authRouter);
app.use("/api/strategies", strategyRouter);
app.use("/api/credentials", credentialsRouter);

/* -------------------------------------------------------
   ICICI — Unified NEW Routing
------------------------------------------------------- */

// Store encrypted broker creds + Connect using API Key/Secret/SessionToken
app.use("/api/icici", iciciBrokerRouter);

// Check connection/session status
app.use("/api/icici", iciciStatusRouter);

// Backtesting (existing separate module)
app.use("/api/icici/backtest", iciciBacktestRouter);

// WebSocket handshake + stream token verification (NEW)
app.use("/api/icici/stream", iciciStreamControlRouter);

/* -------------------------------------------------------
   Global Error Handler
------------------------------------------------------- */
app.use(errorHandler);

export default app;
