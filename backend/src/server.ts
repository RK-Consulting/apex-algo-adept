import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import authRouter from "./routes/auth.js";
import { strategyRouter } from "./routes/strategies.js";
import { credentialsRouter } from "./routes/credentials.js";
import { marketDataRouter } from "./routes/marketData.js";
import { iciciBrokerRouter } from "./routes/iciciBroker.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { requestLogger } from "./middleware/logger.js";

dotenv.config();

const app = express();

// ✅ Use 8080 as default port to match PM2 / Nginx configs
const PORT = Number(process.env.PORT) || 8080;

// ✅ Middleware
app.use(express.json());
app.use(requestLogger);

// ✅ CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || [
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
  })
);

// ✅ Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

// ✅ API Routes
app.use("/api/auth", authRouter);
app.use("/api/strategies", strategyRouter);
app.use("/api/credentials", credentialsRouter);
app.use("/api/market-data", marketDataRouter);
app.use("/api/icici", iciciBrokerRouter);

// ✅ Error handling middleware (always at end)
app.use(errorHandler);

// ✅ Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 AlphaForge Backend Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 Health check: http://0.0.0.0:${PORT}/health`);
});

export default app;
