import dotenv from "dotenv";
import app from "./app.js";
import { iciciBacktestRouter } from "./routes/iciciBacktest.js";


dotenv.config();

const PORT = Number(process.env.PORT) || 8080;

// ✅ Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 AlphaForge Backend Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 Health check: http://0.0.0.0:${PORT}/health`);
});
