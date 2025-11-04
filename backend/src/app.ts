// backend/src/app.ts
import express from "express";
//import cors from "cors";
import corsImport from "cors";
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

// ✅ Basic middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(compression());
app.use(helmet());
app.use(requestLogger);
const cors = (corsImport as any).default || corsImport;
// ✅ CORS setup
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);
const allowedOrigins = [
  "http://localhost:5173",
  "https://alphaforge.skillsifter.in",
  "https://www.alphaforge.skillsifter.in",
  "https://skillsifter.in",
  "https://www.skillsifter.in",
];
app.use(
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

// ✅ Route registrations (exports must match: default vs named)
app.use("/api/auth", authRouter);
app.use("/api/strategies", strategyRouter);
app.use("/api/credentials", credentialsRouter);
app.use("/api/icici/marketData", marketDataRouter);
app.use("/api/icici", iciciBrokerRouter);

// ✅ Error handling middleware (must be last)
app.use(errorHandler);

export default app;
