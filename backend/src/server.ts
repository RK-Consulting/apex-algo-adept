// backend/src/server.ts
import dotenv from "dotenv";

// Load .env BEFORE anything else
dotenv.config();

import http from "http";
import app from "./app.js";

import pool from "./config/database.js";
import debug from "debug";

import { iciciBacktestRouter } from "./routes/iciciBacktest.js";
import { iciciStreamRouter, initIciciStreamServer } from "./routes/icici/stream.js";
import { stopAllRealtimeStreams } from "./services/iciciRealtime.js";

const log = debug("apex:server");

// ------------------------------------------------------------
// 1) Register routers
// ------------------------------------------------------------
app.use("/api/icici/backtest", iciciBacktestRouter);
app.use("/api/icici", iciciStreamRouter); // WebSocket route handshake (HTTP only)

// ------------------------------------------------------------
// 2) Start HTTP server (required for WebSocket Upgrade)
// ------------------------------------------------------------
const PORT = Number(process.env.PORT || 8080);

const server = http.createServer(app);

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 AlphaForge Backend Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`🔗 Health check: http://0.0.0.0:${PORT}/health`);
});

// ------------------------------------------------------------
// 3) Initialize ICICI WebSocket upgrade handler
// ------------------------------------------------------------
try {
  initIciciStreamServer(server);
  console.log("🔌 ICICI WebSocket Stream initialized.");
} catch (err) {
  console.error("❌ Failed to initialize ICICI websocket:", err);
}

// ------------------------------------------------------------
// 4) Graceful Shutdown (PM2, Docker, Kubernetes safe)
// ------------------------------------------------------------
async function shutdown(signal: string) {
  console.log(`\n🛑 Received ${signal}: Shutting down gracefully...`);

  try {
    // Stop receiving new HTTP connections
    await new Promise<void>((resolve) => {
      server.close(() => {
        console.log("✅ HTTP server closed.");
        resolve();
      });
    });

    // Close ICICI realtime streams
    try {
      stopAllRealtimeStreams();
      console.log("📡 All realtime ICICI streams stopped.");
    } catch (e) {
      console.error("⚠️ Error stopping ICICI streams:", e);
    }

    // Close DB pool
    try {
      await pool.end();
      console.log("🗄️ PostgreSQL pool closed.");
    } catch (dbErr) {
      console.error("⚠️ DB pool close error:", dbErr);
    }

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
// 5) Optional: Auto-refresh ICICI Breeze session tokens
// ------------------------------------------------------------
// import("./scripts/refreshIciciSession.js")
//   .then(() => console.log("⏱️ ICICI Session Refresh CRON initialized"))
//   .catch((err) => console.error("❌ CRON init error:", err));
