// backend/src/routes/redis.js
import { Router } from "express";
import redis from "../config/redis.js"; // Redis client

const router = Router();

// Dev monitoring endpoints
router.get("/status", async (_req, res) => {
  try {
    await redis.ping();
    res.json({ success: true, message: "Redis connected", timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ success: false, error: "Redis unreachable" });
  }
});

router.get("/keys", async (_req, res) => {
  try {
    const keys = await redis.keys("*");
    res.json({ success: true, total: keys.length, sample: keys.slice(0, 20) });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to fetch keys" });
  }
});

// Default export (critical for the import above)
export default router;
