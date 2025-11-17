// backend/src/app.ts
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import compression from "compression";

import { requestLogger } from "./middleware/logger.js";
import { errorHandler } from "./middleware/errorHandler.js";

// === Routers ===
import authRouter from "./routes/auth.js";
import { strategyRouter } from "./routes/strategies.js";
import { credentialsRouter } from "./routes/credentials.js";

import { orderRouter } from "./routes/icici/orders.js";
import { portfolioRouter } from "./routes/icici/portfolio.js";
import { marketDataRouter } from "./routes/icici/marketData.js";
import { iciciConnectRouter } from "./routes/icici/connect.js";
import { iciciBacktestRouter } from "./routes/iciciBacktest.js";
import { iciciMeRouter } from "./routes/icici/me.js";
import { iciciBrokerRouter } from "./routes/iciciBroker.js";

dotenv.config();

const app = express();

/* -------------------------------------------------------
   1) CORS CONFIG
------------------------------------------------------- */
const allowed = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const allowedOrigins = [
  ...allowed,
  "http://localhost:5173",
  "http://localhost:4173",
  "https://alphaforge.skillsifter.in",
  "https://www.alphaforge.skillsifter.in",
];

console.log("CORS Allowed Origins:", allowedOrigins);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      console.warn("CORS BLOCKED:", origin);
      return callback(new Error("Not allowed by CORS"), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Authorization",
      "Content-Type",
      "X-Requested-With",
      "Accept",
      "Origin",
      "Cache-Control",
    ],
    exposedHeaders: ["Content-Length", "X-Request-ID"],
    optionsSuccessStatus: 204,
  })
);

// Global OPTIONS handler
app.options("*", cors());

/* -------------------------------------------------------
   2) Security
------------------------------------------------------- */
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'",
          "https://www.google-analytics.com",
          "https://static.cloudflareinsights.com",
          "https://gc.kis.v2.scr.kaspersky-labs.com",
          "wss://gc.kis.v2.scr.kaspersky-labs.com",
        ],
        connectSrc: [
          "'self'",
          "https://alphaforge.skillsifter.in",
          "https://www.alphaforge.skillsifter.in",
          "https://api.alphaforge.skillsifter.in",
          "wss://api.icicidirect.com",
          "wss://gc.kis.v2.scr.kaspersky-labs.com",
        ],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

/* -------------------------------------------------------
   3) Parsing, Logging, Compression
------------------------------------------------------- */
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(requestLogger);

/* -------------------------------------------------------
   4) Health Check
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
   5) Routes
------------------------------------------------------- */

// AUTH + USER ROUTES
app.use("/api/auth", authRouter);
app.use("/api/strategies", strategyRouter);
app.use("/api/credentials", credentialsRouter);

// ICICI ROUTES — unified path prefix
app.use("/api/icici", iciciConnectRouter);
app.use("/api/icici", orderRouter);
app.use("/api/icici", portfolioRouter);
app.use("/api/icici", marketDataRouter);
app.use("/api/icici", iciciBacktestRouter);
app.use("/api/icici", iciciMeRouter);

// LEGACY broker route
app.use("/api/iciciBroker", iciciBrokerRouter);

/* -------------------------------------------------------
   6) Global Error Handler
------------------------------------------------------- */
app.use(errorHandler);

export default app;
