// backend/src/app.ts
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import compression from "compression";
import { requestLogger } from "./middleware/logger.js";
import { errorHandler } from "./middleware/errorHandler.js";

// Routers
import authRouter from "./routes/auth.js";
import { strategyRouter } from "./routes/strategies.js";
import { credentialsRouter } from "./routes/credentials.js";
import { iciciOrdersRouter } from "./routes/icici/orders.js";
import { iciciPortfolioRouter } from "./routes/icici/portfolio.js";
import { marketDataRouter } from "./routes/icici/marketData.js";
import { iciciBrokerRouter } from "./routes/iciciBroker.js";
import { iciciBacktestRouter } from "./routes/iciciBacktest.js";
import { iciciMeRouter } from "./routes/icici/me.js";


dotenv.config();

const app = express();

/* -------------------------------------------------------
   1) CORS CONFIGURATION — ROCK SOLID & FUTURE-PROOF
   - Uses .env for dynamic origins
   - Auto-allows preflight for all routes
   - Logs rejected origins
   - Supports credentials (cookies, auth headers)
------------------------------------------------------- */
const rawOrigins = process.env.ALLOWED_ORIGINS || "";
const allowedOrigins = rawOrigins
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean)
  .concat([
    "http://localhost:5173",
    "http://localhost:4173",
    "https://alphaforge.skillsifter.in",
    "https://www.alphaforge.skillsifter.in",
  ]);

console.log("CORS Allowed Origins:", allowedOrigins);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow tools like Postman, curl, or server-to-server (no origin)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.warn(`CORS REJECTED: ${origin}`);
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
    preflightContinue: false,
    optionsSuccessStatus: 204,
  })
);

// GLOBAL PREFLIGHT HANDLER — NEVER MISS AN OPTIONS REQUEST
app.options("*", cors());

/* -------------------------------------------------------
   2) SECURITY HEADERS (Helmet) — Safe for WebSockets
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
          "https://api.alphaforge.skillsifter.in",
          "https://www.alphaforge.skillsifter.in",
          "wss://api.icicidirect.com",
          "wss://gc.kis.v2.scr.kaspersky-labs.com",
        ],
        imgSrc: ["'self'", "data:", "https:"],
        styleSrc: ["'self'", "'unsafe-inline'", "https:"],
        fontSrc: ["'self'", "https:", "data:"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

/* -------------------------------------------------------
   3) Body Parsing, Compression, Logging
------------------------------------------------------- */
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(requestLogger);

/* -------------------------------------------------------
   4) Routes
------------------------------------------------------- */
app.get("/health", (_req, res) =>
  res.status(200).json({
    status: "OK",
    service: "alphaforge-api",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })
);

app.use("/api/auth", authRouter);
app.use("/api/strategies", strategyRouter);
app.use("/api/credentials", credentialsRouter);
app.use("/api/iciciBroker", iciciBrokerRouter);
app.use("/api/icici/market", marketDataRouter);
app.use("/api/iciciBacktest", iciciBacktestRouter);
app.use("/api/icici/orders", iciciOrdersRouter);
app.use("/api/icici/portfolio", iciciPortfolioRouter);
app.use("/api/icici/me", iciciMeRouter);

/* -------------------------------------------------------
   5) Global Error Handler — MUST BE LAST
------------------------------------------------------- */
app.use(errorHandler);

export default app;
