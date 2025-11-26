// backend/load-env.cjs
import dotenv from "dotenv";
// dotenv.config({ path: "/var/www/apex-algo-adept/backend/.env" });
// Load .env before anything else
require("dotenv").config({ path: "/var/www/apex-algo-adept/backend/.env" });

// Start the real server
require("./dist/server.js");
