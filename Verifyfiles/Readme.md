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

