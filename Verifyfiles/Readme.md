Ubuntu + Nginx deployment, Brotli, HTTPS, and Cloudflare integration.
---------------------------------------------------------------------

This setup includes:

🧱 Dockerfile for Backend (Node.js + Express + TypeScript)

⚛️ Dockerfile for Frontend (Vite + React)

🐳 docker-compose.yml (orchestration of backend + frontend + PostgreSQL)

🔒 .env.production mapping

⚙️ Optional PM2 inside container

🌍 Integrated with Nginx reverse proxy (as you already configured manually)


#Directory Structure
=======================
/var/www/apex-algo-adept/
│
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   └── .env.production
│
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.js
│   ├── src/
│   └── .env.production
│
├── docker-compose.yml
└── nginx/
    └── sites-available/
        └── alphaforge.skillsifter.in

How to deploy (single command setup)
====================================
cd /var/www/apex-algo-adept
sudo docker-compose build
sudo docker-compose up -d

Check logs:
===========
sudo docker-compose logs -f backend

Access your app:
================
Frontend → https://alphaforge.skillsifter.in
Backend API → https://api.alphaforge.skillsifter.in
Health Check → https://api.alphaforge.skillsifter.in/health

Optional PM2 Health Restart (if you ever need it)
=================================================
Inside backend container:
=========================
docker exec -it alphaforge_backend pm2 list
docker exec -it alphaforge_backend pm2 logs
docker exec -it alphaforge_backend pm2 restart all

Security + Performance Checklist
================================
Feature	                                Status
Brotli compression	                    ✅ Enabled (nginx dynamic module)
Gzip fallback	                          ✅ Enabled
OCSP stapling + resolver	              ✅ Configured
TLS 1.2 + 1.3 only	                    ✅ Enforced
CSP, XSS, HSTS headers	                ✅ Hardened
Cloudflare proxy + caching	            ✅ Frontend only
CORS strict whitelist	                  ✅ Backend verified
Dockerized backend/frontend	            ✅ Yes
Postgres persistent volume	            ✅ pgdata

⚙️ Current Production Status Summary
Layer	Component	Status	Notes
🌐 DNS	api.alphaforge.skillsifter.in → 64.227.175.198	✅	Cloudflare DNS only
🔒 TLS	Let's Encrypt via Certbot	✅	Cert valid till Jan 2026
🚀 Backend	Express (PM2)	✅	Responds OK
🔁 Proxy	Nginx reverse proxy	✅	Secure, gzip+brotli enabled
🧱 Security	HSTS, CSP, OCSP, headers	✅	A+ grade
🌍 Frontend	alphaforge.skillsifter.in (Cloudflare Pages)	✅	Proxied via Cloudflare
🔗 API Connection	Backend reachable via HTTPS	✅	Verified live

PostgreSQL auto-setup script (init_db.sql) that you can run once to create all the required tables, indexes, and relationships for your AlphaForge / BreezeConnect backend — including authentication, ICICI credentials, strategies, and market data logging.
You can run this via:

psql -U postgres -d alphaforge -f init_db.sql


or if you want it automated in Node:

npm run db:init


(using a helper script I’ll show below).
Optional Node Helper to Run Automatically

If you’d like to automate this SQL initialization directly from your backend (during setup or CI/CD), create a small script:

📁 File: scripts/initDb.ts

import fs from "fs";
import path from "path";
import { query } from "../src/config/database.js";

async function initDatabase() {
  const sqlPath = path.resolve("database/init_db.sql");
  const sql = fs.readFileSync(sqlPath, "utf-8");
  console.log("🚀 Running database initialization...");
  await query(sql);
  console.log("✅ Database initialized successfully.");
  process.exit(0);
}

initDatabase().catch((err) => {
  console.error("❌ DB initialization failed:", err);
  process.exit(1);
});


Then in package.json:

"scripts": {
  "db:init": "ts-node scripts/initDb.ts"
}


Run it with:

npm run db:init

✅ Summary — After Running Script, You’ll Have:
Table	                        Purpose
users	                        Authentication (JWT)
broker_credentials	            ICICI Breeze / API keys
strategies	                    User-defined algo strategies
market_data	                    Real-time data snapshots
orders	                        ICICI order tracking
trades	                        Executed trade history
api_logs	                    API usage + audit trail



How to Deploy / Manage

1️⃣ Build the project
cd backend
npm run build

(this compiles TypeScript to /dist)

2️⃣ Start PM2 in production
pm2 start ecosystem.config.js --env production

3️⃣ Check logs
pm2 logs apex-backend

4️⃣ Restart or stop
pm2 restart apex-backend
pm2 stop apex-backend

5️⃣ Enable startup on boot
pm2 startup systemd
pm2 save

🧠 Optional: Auto-Restart on File Change (Dev Mode)

If you’re developing locally:

pm2 start ecosystem.config.js --env development --watch
