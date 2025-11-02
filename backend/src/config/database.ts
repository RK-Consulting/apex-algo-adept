// src/config/database.ts
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

/**
 * PostgreSQL connection pool configuration
 */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false } // ✅ required for remote DBs like Render/Neon
      : false, // disable for local
});

pool.on("connect", () => {
  console.log("✅ PostgreSQL connected successfully");
});

pool.on("error", (err) => {
  console.error("❌ Unexpected database error:", err);
});

/**
 * Utility for running queries with performance logging
 */
export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV !== "production") {
      console.log("🧩 SQL:", { text, duration: `${duration}ms`, rows: res.rowCount });
    }
    return res;
  } catch (error) {
    console.error("❌ Database query error:", error);
    throw error;
  }
};

/**
 * Get a pooled client for transactions
 */
export const getClient = async () => {
  const client = await pool.connect();
  return client;
};

export default pool;
