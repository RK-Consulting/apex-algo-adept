// src/config/database.ts
import pg from "pg";
import dotenv from "dotenv";
import debug from "debug";

dotenv.config();

const log = debug("apex:db");
const { Pool } = pg;

/* ------------------------------------------------------------------
   1) Validate essential ENV variables early
------------------------------------------------------------------- */
if (!process.env.DATABASE_URL) {
  throw new Error("❌ DATABASE_URL missing in environment variables.");
}

/* ------------------------------------------------------------------
   2) Configure connection pool with safe defaults
------------------------------------------------------------------- */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DB_POOL_MAX || 10),           // max concurrent connections
  idleTimeoutMillis: Number(process.env.DB_IDLE_MS || 30_000),
  connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT_MS || 10_000),
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : undefined,
});

/* ------------------------------------------------------------------
   3) Event logging
------------------------------------------------------------------- */
pool.on("connect", () => {
  console.log("✅ PostgreSQL pool connected");
});

pool.on("error", (err) => {
  console.error("❌ PostgreSQL unexpected client error:", err);
});

/* ------------------------------------------------------------------
   4) Safe query helper with debug logging (not noisy in production)
------------------------------------------------------------------- */
export const query = async (text: string, params?: any[]) => {
  const start = Date.now();

  try {
    const result = await pool.query(text, params);

    if (process.env.NODE_ENV !== "production") {
      log("SQL:", {
        query: text.replace(/\s+/g, " ").trim(),
        rows: result.rowCount,
        duration: `${Date.now() - start}ms`,
      });
    }

    return result;
  } catch (err) {
    console.error("❌ DB Query Error:", err);
    console.error("❌ Faulty SQL:", text);
    throw err;
  }
};

/* ------------------------------------------------------------------
   5) Transaction helper (safe)
------------------------------------------------------------------- */
export const getClient = async () => {
  const client = await pool.connect();

  const release = client.release.bind(client);

  // Patch release to prevent double release errors
  client.release = () => {
    try {
      release();
    } catch (err) {
      console.error("⚠️ PostgreSQL double-release attempt prevented", err);
    }
  };

  return client;
};

/* ------------------------------------------------------------------
   6) Health check at startup
------------------------------------------------------------------- */
(async () => {
  try {
    await pool.query("SELECT 1");
    console.log("🟢 PostgreSQL is ready");
  } catch (err) {
    console.error("🔴 PostgreSQL connection failed at startup:", err);
  }
})();

export default pool;
