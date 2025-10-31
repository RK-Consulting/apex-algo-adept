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



