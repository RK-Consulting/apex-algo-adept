# Changelog

All notable changes to AlphaForge are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/), versioning follows [SemVer](https://semver.org/).

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
