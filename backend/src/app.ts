// backend/src/app.ts
import express from "express";
//import cors from "cors";
import dotenv from "dotenv";
//import helmet from "helmet";
import helmetImport from "helmet";
//import compression from "compression";
import compressionImport from "compression";
import { requestLogger } from "./middleware/logger.js";
import { errorHandler } from "./middleware/errorHandler.js";

// Routers
import { authRouter } from "./routes/auth.js";
import { strategyRouter } from "./routes/strategies.js";
import { credentialsRouter } from "./routes/credentials.js";
import { marketDataRouter } from "./routes/icici/marketData.js";
import { iciciBrokerRouter } from "./routes/iciciBroker.js";

import corsImport from "cors";
const cors = (corsImport as any).default || corsImport;
const helmet = (helmetImport as any).default || helmetImport;
const compression = (compressionImport as any).default || compressionImport;

// Load environment variables
dotenv.config();

const app = express();

// ✅ Debug check before route registration
console.log("🔍 Router checks:", {
  authRouter,
  strategyRouter,
  credentialsRouter,
  marketDataRouter,
  iciciBrokerRouter,
});


// ✅ Basic middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(compression());
app.use(helmet());
//app.use(helmet.default ? helmet.default() : helmet());
app.use(requestLogger);

// ✅ CORS setup
const allowedOrigins =
  (process.env.ALLOWED_ORIGINS || "").split(",").filter(Boolean) || [
    "http://localhost:5173",
    "https://skillsifter.in",
    "https://www.skillsifter.in",
  ];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`🚫 CORS blocked request from: ${origin}`);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

// ✅ Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "AlphaForge Backend API",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

// ✅ Route registrations
app.use("/api/auth", authRouter);
app.use("/api/strategies", strategyRouter);
app.use("/api/credentials", credentialsRouter);
app.use("/api/icici/marketData", marketDataRouter);
app.use("/api/icici", iciciBrokerRouter);


export default app;
