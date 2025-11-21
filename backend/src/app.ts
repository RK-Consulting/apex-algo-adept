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

// ICICI Modules
import { iciciBrokerRouter } from "./routes/iciciBroker.js";
import { marketDataRouter } from "./routes/icici/marketData.js";
import { iciciOrdersRouter } from "./routes/icici/orders.js";
import { iciciPortfolioRouter } from "./routes/icici/portfolio.js";
import { iciciMeRouter } from "./routes/icici/me.js";
import { iciciAuthCallbackRouter } from "./routes/icici/authCallback.js";
import { iciciStatusRouter } from "./routes/icici/status.js";
import { iciciStreamRouter } from "./routes/icici/stream.js";

import { iciciBacktestRouter } from "./routes/iciciBacktest.js";

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

      // Cloudflare pages previews
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
   Main API Routes
------------------------------------------------------- */
app.use("/api/auth", authRouter);
app.use("/api/strategies", strategyRouter);
app.use("/api/credentials", credentialsRouter);

/* -------------------------------------------------------
   ICICI — Unified Routing
------------------------------------------------------- */
app.use("/api/icici", iciciBrokerRouter);         // Store encrypted API keys
app.use("/api/icici", iciciAuthCallbackRouter);   // OAuth-like callback
app.use("/api/icici", iciciStatusRouter);         // Broker connection status

app.use("/api/icici/market", marketDataRouter);   // LTP, quotes, OHLC
app.use("/api/icici", iciciOrdersRouter);         // Orders
app.use("/api/icici/portfolio", iciciPortfolioRouter); // Holdings, positions
app.use("/api/icici", iciciMeRouter);             // Breeze session validation

app.use("/api/icici/backtest", iciciBacktestRouter);
app.use("/api/icici", iciciStreamRouter);         // WebSocket handshake

/* -------------------------------------------------------
   Global Error Handler
------------------------------------------------------- */
app.use(errorHandler);

export default app;
