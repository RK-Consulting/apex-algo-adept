// backend/src/server.ts
import dotenv from "dotenv";
dotenv.config({ path: "/var/www/apex-algo-adept/backend/.env" });

import http from "http";
import debug from "debug";
import app from "./app.js";
import pool from "./config/database.js";
import redis from "./config/redis.js";

// Correct ICICI WS initializer import
import { initIciciStreamServer } from "./modules/broker/breeze/routes/stream.js";

import { iciciRealtimeService } from "./modules/broker/breeze/breeze.realtime.js";

const log = debug("apex:server");
const PORT = Number(process.env.PORT || 3000);

const server = http.createServer(app);

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 AlphaForge Backend running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`🔗 Health: http://0.0.0.0:${PORT}/health`);
});

// Initialize WebSocket Upgrade Handler
try {
  initIciciStreamServer(server);
  console.log("🔌 ICICI Realtime WebSocket initialized.");
} catch (err) {
  console.error("❌ Failed to initialize ICICI WebSocket:", err);
}

// Graceful shutdown
async function shutdown(signal: string) {
  console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);
  try {
    await new Promise<void>((resolve) =>
      server.close(() => {
        console.log("🛑 HTTP server closed.");
        resolve();
      })
    );

    // Stop all ICICI realtime streams
    try {
      await iciciRealtimeService.stopAll()
      console.log("📡 All ICICI realtime streams stopped.");
    } catch (err) {
      console.error("⚠ Error stopping realtime streams:", err);
    }

    // Close DB pool
    try {
      await pool.end();
      console.log("🗄 PostgreSQL pool closed.");
    } catch (dbErr) {
      console.error("⚠ DB close error:", dbErr);
    }

    // Close Redis
    await redis.quit();
    console.log("Redis connection closed.");

    console.log("👋 Shutdown complete.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Forced shutdown due to error:", err);
    process.exit(1);
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
