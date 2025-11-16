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
import marketDataRouter from "./routes/icici/marketData.js";
import { iciciBrokerRouter } from "./routes/iciciBroker.js";

dotenv.config();

const app = express();

/* -------------------------------------------------------
   1) CORS CONFIGURATION (Strict + Production-safe)
------------------------------------------------------- */
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:4173",
  "https://alphaforge.skillsifter.in",
  "https://www.alphaforge.skillsifter.in",
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow Postman / internal calls without origin
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.warn(`🚫 CORS Rejected: ${origin}`);
      return callback(new Error("CORS not allowed from this origin"), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Authorization",
      "Content-Type",
      "X-Requested-With",
      "Accept",
      "Origin",
    ],
    exposedHeaders: ["Content-Length"],
  })
);

// Handle preflight requests
app.options("*", cors());


/* -------------------------------------------------------
   2) SECURITY HEADERS (Helmet)
   Breeze Connect WebSocket & frontend bundlers require COEP OFF
------------------------------------------------------- */
app.use(
  helmet({
    contentSecurityPolicy: {
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
          "wss://api.icicidirect.com",        // Breeze WebSocket
          "wss://gc.kis.v2.scr.kaspersky-labs.com",
        ],

        imgSrc: ["'self'", "data:", "https:"],
        styleSrc: ["'self'", "'unsafe-inline'", "https:"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
  })
);


/* -------------------------------------------------------
   3) Parsing, Compression, Logging
------------------------------------------------------- */
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);


/* -------------------------------------------------------
   4) Routes
------------------------------------------------------- */
app.get("/health", (_req, res) =>
  res.status(200).json({ status: "ok", ts: new Date().toISOString() })
);

app.use("/api/auth", authRouter);
app.use("/api/strategies", strategyRouter);
app.use("/api/credentials", credentialsRouter);
app.use("/api/icici", iciciBrokerRouter);           // /funds /portfolio /order
app.use("/api/icici/market", marketDataRouter);     // /subscribe /quotes


/* -------------------------------------------------------
   5) Global Error Handler (must be last)
------------------------------------------------------- */
app.use(errorHandler);

export default app;
