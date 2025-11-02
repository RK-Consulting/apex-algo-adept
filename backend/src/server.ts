// backend/src/server.ts
import dotenv from "dotenv";
import app from "./app.js";
import { iciciBacktestRouter } from "./routes/iciciBacktest.js";

// Load environment variables
dotenv.config();

// ✅ Ensure port consistency (8080 default)
const PORT = Number(process.env.PORT) || 8080;

// ✅ Register additional route modules that aren’t yet in app.ts
// (app.ts already registers auth, strategies, credentials, market-data, and iciciBroker)
app.use("/api/icici", iciciBacktestRouter);

// ✅ Start server
const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 AlphaForge Backend Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`🔗 Health check: http://0.0.0.0:${PORT}/health`);
});

// ✅ Graceful shutdown for Docker / PM2
process.on("SIGINT", () => {
  console.log("🛑 Shutting down server...");
  server.close(() => {
    console.log("✅ Server closed gracefully.");
    process.exit(0);
  });
});
