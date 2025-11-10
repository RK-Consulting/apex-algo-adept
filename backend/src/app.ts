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

// Load environment variables
dotenv.config();

const app = express();

// ✅ 1. Strict CORS setup — handled ONLY by Express
const allowedOrigins = [
  "http://localhost:5173",
  "https://alphaforge.skillsifter.in",
  "https://www.alphaforge.skillsifter.in",
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like curl, Postman)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      console.warn(`🚫 CORS blocked request from: ${origin}`);
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

// Handles preflight globally
app.options("*", cors());

// ✅ 2. Helmet — safe after CORS
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
          "https://gc.kis.v2.scr.kaspersky-labs.com",
          "wss://gc.kis.v2.scr.kaspersky-labs.com",
          "https://static.cloudflareinsights.com",
        ],
        connectSrc: [
          "'self'",
          "https://alphaforge.skillsifter.in",
          "https://api.alphaforge.skillsifter.in",
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

// ✅ 3. Compression & body parsing
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ✅ 4. Logging middleware
app.use(requestLogger);

// ✅ 5. Routes
app.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));
app.use("/api/auth", authRouter);
app.use("/api/strategies", strategyRouter);
app.use("/api/credentials", credentialsRouter);
app.use("/api/icici", iciciBrokerRouter);
app.use("/api/icici/market", marketDataRouter);

// ✅ 6. Error handler
app.use(errorHandler);

export default app;




/* // backend/src/app.ts
import express from "express";
import cors from "cors";
//import corsImport from "cors";
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

// Load environment variables
dotenv.config();
//const cors = (corsImport as any).default || corsImport;
// ✅ CORS setup
//const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
 // .split(",")
 // .map(s => s.trim())
 // .filter(Boolean);
const allowedOrigins = [
  "http://localhost:5173",
  "https://alphaforge.skillsifter.in",
  "https://api.alphaforge.skillsifter.in",
  //"https://www.alphaforge.skillsifter.in",
  //"https://www.api.alphaforge.skillsifter.in",
  //"https://skillsifter.in",
  //"https://www.skillsifter.in",
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests without an Origin (e.g. curl, Postman)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      console.warn(`🚫 CORS blocked request from: ${origin}`);
      return callback(new Error("CORS not allowed from this origin"), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
    ],
    exposedHeaders: ["Content-Length", "X-Knowledge-Base-ID"],
  })
);

// Handle preflight (OPTIONS) globally
app.options("*", cors()); */
/*app.use(
  cors({
    origin: (origin, callback) => {
      // allow requests with no origin (like curl, server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`🚫 CORS blocked request from: ${origin}`);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    //allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",           // ← ADD THIS
      "X-Requested-With",
      "Accept",
      "Origin"
    ],
  })
); */
//const app = express();

// ✅ Basic middleware
/*app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(compression());
//app.use(helmet());
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        "'unsafe-eval'",
        "https://www.google-analytics.com",
        "https://gc.kis.v2.scr.kaspersky-labs.com",
        "wss://gc.kis.v2.scr.kaspersky-labs.com",
        "https://static.cloudflareinsights.com" // ← ADD THIS
      ],
      connectSrc: [
        "'self'",
        "https://api.alphaforge.skillsifter.in",
        "wss://gc.kis.v2.scr.kaspersky-labs.com"
      ],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false,
}));
app.use(requestLogger);

// ✅ Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "AlphaForge Backend API",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

// ✅ Route registrations (exports must match: default vs named)
app.use("/api/auth", authRouter);
app.use("/api/strategies", strategyRouter);
app.use("/api/credentials", credentialsRouter);
app.use("/api/icici/marketData", marketDataRouter);
app.use("/api/icici", iciciBrokerRouter);

// ✅ Error handling middleware (must be last)
app.use(errorHandler);

export default app; */
