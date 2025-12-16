// backend/src/app.ts
import dotenv from "dotenv";
dotenv.config({ path: "/var/www/apex-algo-adept/backend/.env" });
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { loginLimiter, apiLimiter, authLimiter } from './middleware/rateLimiter.js';  // Consolidated
import { authenticateToken } from './middleware/auth.js';  // Consistent naming
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/logger.js';
import { iciciOrderRoutes } from './routes/icici/orders.js';  // Default import if named export missing
import { iciciAuthRoutes } from './routes/iciciAuth.js';
import { iciciBrokerRoutes } from './routes/iciciBroker.js';
import { iciciStatusRoutes } from './routes/iciciStatus.js';
import { iciciStreamRoutes } from './routes/icici/stream.js';
import { strategiesRoutes } from './routes/strategies.js';
import { watchlistRoutes } from './routes/watchlist.js';
import { authRoutes } from './routes/auth.js';
import { credentialsRoutes } from './routes/credentials.js';
import { aiRoutes } from './routes/ai.js';
import { redisRoutes } from './routes/redis.js';
// (REMOVE unused authLogin/authCallback routers)

const app = express();

// Security, compression, parsers
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
//app.use(cors({ origin: process.env.FRONTEND_URL || 'https://alphaforge.skillsifter.in' }));
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

// -----------------------------------------------------------
// CORE API
// -----------------------------------------------------------
app.use("/api/auth", authRouter);
app.use('/api/credentials', authenticateToken, credentialsRoutes);
app.use('/api/strategies', authenticateToken, strategiesRoutes);
app.use('/api/watchlist', authenticateToken, watchlistRoutes);
app.use('/api/ai', authenticateToken, aiRoutes);
app.use('/api/redis', redisRoutes);  // Dev-only
app.use('/api/icici/broker', authenticateToken, iciciBrokerRoutes);
app.use('/api/icici/status', authenticateToken, iciciStatusRoutes);
app.use('/api/icici/stream', authenticateToken, iciciStreamRoutes);

/* check below
// Apply globally or selectively
app.use("/api/", apiLimiter);                           // 100 req/min for all API
app.use("/api/icici/auth/complete", loginLimiter);      // 10 attempts per 15 min for ICICI login
app.use("/api/auth/login", loginLimiter);               // also protect your own login
// Auth routes with stricter limiter
app.use("/api/auth", authLimiter, authRouter);
*/

// -----------------------------------------------------------
// ICICI DIRECT API STACK (FINAL + CORRECT)
// -----------------------------------------------------------

// 🔥 This router contains:
// GET /api/icici/auth/login         → opens ICICI login page
// POST /api/icici/auth/callback     → receives apisession
app.use('/api/icici', authenticateToken, iciciAuthRoutes);
// Orders engine
app.use('/api/icici', authenticateToken, iciciOrderRoutes);

// Backtesting
app.use("/api/icici/backtest", iciciBacktestRouter);

// -----------------------------------------------------------
// GLOBAL ERROR HANDLER
// -----------------------------------------------------------
app.use(errorHandler);
//app.post("/api/icici/auth/complete", loginLimiter, iciciAuthCallbackRouter);

export default app;
