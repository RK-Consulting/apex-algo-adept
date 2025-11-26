// backend/load-env.cjs
//import dotenv from "dotenv";
// dotenv.config({ path: "/var/www/apex-algo-adept/backend/.env" });
// Load .env before anything else
//require("dotenv").config({ path: "/var/www/apex-algo-adept/backend/.env" });

// Start the real server
//require("./dist/server.js");

/**
 * CommonJS loader that:
 * 1. Loads .env using require (dotenv)
 * 2. Dynamically imports the ESM server.js
 */

require("dotenv").config({
  path: "/var/www/apex-algo-adept/backend/.env"
});

// Start ESM server.js using dynamic import
import("/var/www/apex-algo-adept/backend/dist/server.js")
  .catch(err => {
    console.error("🔥 Failed to start ESM server:", err);
    process.exit(1);
  });

