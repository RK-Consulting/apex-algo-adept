// backend/src/server.ts
import dotenv from "dotenv";

// Load .env BEFORE imports that rely on it
dotenv.config();

import app from "./app.js";
import { iciciBacktestRouter } from "./routes/iciciBacktest.js";
import pool from "./config/database.js";
import debug from "debug";

const log = debug("apex:server");

// ------------------------------------------------------------
// 1) Register missing router modules
// ------------------------------------------------------------
app.use("/api/icici/backtest", iciciBacktestRouter);

// ------------------------------------------------------------
// 2) Determine server port
// ------------------------------------------------------------
const PORT = Number(process.env.PORT || 8080);

// ------------------------------------------------------------
// 3) Start HTTP server
// ------------------------------------------------------------
const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 AlphaForge Backend Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`🔗 Health check: http://0.0.0.0:${PORT}/health`);
});

// ------------------------------------------------------------
// 4) Graceful Shutdown (Node + Docker + PM2 + Kubernetes)
// ------------------------------------------------------------
async function shutdown(signal: string) {
  console.log(`\n🛑 Received ${signal}: Shutting down gracefully...`);

  try {
    // Stop accepting new HTTP requests
    await new Promise<void>((resolve) => {
      server.close(() => {
        console.log("✅ HTTP server closed.");
        resolve();
      });
    });

    // Close DB pool
    try {
      await pool.end();
      console.log("🗄️ PostgreSQL pool closed.");
    } catch (dbErr) {
      console.error("⚠️ DB pool close error:", dbErr);
    }

    // If you later add Redis:
    // await redis.quit();

    // If you later add ICICI realtime stream:
    // stopAllRealtimeStreams();

    console.log("👋 Shutdown complete.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Forced shutdown due to error:", err);
    process.exit(1);
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// ------------------------------------------------------------
// 5) Optional: Start ICICI session auto-refresh CRON
// ------------------------------------------------------------
// import("./scripts/refreshIciciSession.js")
//   .then(() => console.log("⏱️ ICICI Session Refresh CRON initialized"))
//   .catch((err) => console.error("❌ CRON init error:", err));
