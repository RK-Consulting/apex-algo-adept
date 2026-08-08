# Changelog

All notable changes to AlphaForge are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/), versioning follows [SemVer](https://semver.org/).

## [0.2.0] - 2026-08-08

### Major infrastructure overhaul

- **Backend restructured** into domain modules (auth, broker/breeze, strategy,
  portfolio, market, ai, backtest, indicators, scanner, alerts) with shared/
  for cross-module utilities; frontend separated into its own top-level folder
- **Dockerized the backend** — multi-stage build, verified on a disposable VM
  and end-to-end on production with zero downtime; Postgres/Redis/Nginx
  deliberately kept native on the host (not containerized) for data-sovereignty
  and vendor-flexibility reasons
- **CI pipeline** — GitHub Actions running lint/build/test on both frontend
  and backend on every push, now genuinely green
- **ESLint** configured on both sides; backend now 0 errors, 0 warnings
  (down from 91 issues); frontend 0 errors, 44 warnings tracked and
  deliberately deferred
- **Security**: rotated all previously-exposed secrets (JWT secret,
  credential encryption key, DB password, Redis password), scrubbed
  committed .env files from git history; resolved Dependabot findings —
  backend 14 -> 0, frontend 15 -> 2 (deferred, dev-server-only exposure)
- **Removed all Lovable dependencies and branding** — AI strategy generation
  now uses OpenRouter instead of Lovable's AI gateway
- **UFW firewall** enabled and cleaned up
- **Reusable deploy script** (`scripts/deploy.sh`) and server backup/
  provisioning scripts (`infra/backup.sh`, `infra/provision.sh`) added
- Fixed hardcoded server paths in dotenv config loading that broke on
  redeploy; fixed URL-encoding bug in DATABASE_URL for passwords containing
  special characters


## [0.1.0] - 2026-08-07

### Baseline snapshot before module restructuring

- Repository renamed from `apex-algo-adept` to `alphaforge`
- Removed committed `.env` files from git history; rotated all exposed secrets
  (JWT secret, credential encryption key, DB password, Redis password)
- Corrected version number from 1.0.0 (default) to 0.1.0 (honest pre-production baseline)
- Existing features at this point:
  - JWT-based authentication
  - ICICI Direct (Breeze API) broker integration — session FSM, order placement,
    real-time streaming, encrypted credential storage
  - Basic strategy, watchlist, and profile CRUD
  - AI-assisted strategy generation (via OpenRouter)
- Known gaps: no indicator engine, no scanner, no real backtesting engine,
  no automated tests confirmed, no CI/CD

[0.1.0]: https://github.com/RK-Consulting/alphaforge/releases/tag/v0.1.0
