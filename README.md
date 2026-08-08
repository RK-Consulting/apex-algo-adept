# AlphaForge (Apex Algo Adept)

AlphaForge is an algorithmic trading platform for Indian markets. It combines a React/TypeScript frontend with an Express/TypeScript backend, PostgreSQL storage, and a live integration with ICICI Direct's Breeze API for market data, order execution, and session management. The platform also supports AI-assisted strategy generation.

## Features

- **Strategy management** — create, generate (AI-assisted), update, and monitor trading strategies
- **ICICI Direct (Breeze API) integration** — broker connection flow, session lifecycle management (FSM-based), order placement, and real-time market data streaming
- **Market data** — live streaming and historical data endpoints, with Redis-backed caching
- **Portfolio & analytics** — portfolio tracking, stock details, and analytics views
- **Authentication** — JWT-based auth with bcrypt password hashing
- **Secure credential storage** — AES-256-GCM encrypted broker credentials
- **Watchlists & user profiles**

## Tech Stack

**Frontend**
- Vite, React 18, TypeScript
- shadcn-ui (Radix UI primitives) + Tailwind CSS
- React Router, TanStack Query, React Hook Form + Zod

**Backend**
- Node.js, Express, TypeScript
- PostgreSQL (`pg`)
- Redis (`ioredis`) for caching/session state
- JWT auth, bcrypt, Helmet, CORS, rate limiting
- `breezeconnect` SDK for ICICI Direct integration

## Project Structure

```
.
├── src/                    # Frontend application (React)
│   ├── pages/               # Route-level pages (Markets, Portfolio, Strategies, Analytics, Settings, etc.)
│   ├── components/          # UI components
│   ├── context/, hooks/, services/, api/, lib/
│
├── backend/                 # Standalone Express API server
│   ├── src/
│   │   ├── server.ts         # Entry point
│   │   ├── app.ts            # Express app setup
│   │   ├── config/           # Database, Redis, Breeze config
│   │   ├── controllers/      # Auth & ICICI order controllers
│   │   ├── middleware/       # Auth, rate limiting, logging, error handling, ICICI guard
│   │   ├── routes/           # auth, strategies, credentials, watchlist, profile, icici/*, redis, ai
│   │   ├── services/         # Session service, Breeze client, ICICI session FSM, cache, realtime
│   │   ├── utils/            # JWT, encryption, retry, circuit breaker, symbol mapping
│   │   └── scripts/          # Maintenance scripts (e.g. expiring ICICI sessions)
│   └── ICICI_BREEZE_SETUP.md # Guide for connecting an ICICI Direct account
│
├── database/
│   ├── init.sql              # Base schema
│   └── migrations/           # SQL migrations
│
├── scripts/
│   ├── db/                   # Migration, verification, and fix-up scripts
│   ├── icici/                # ICICI login/guard verification scripts
│   ├── env/                  # Environment verification
│   └── deploy/                # Staging/production deploy scripts
│
├── infra/env/                # Environment loading helpers
├── Verifyfiles/               # Docker build files + Postman collection for manual verification
├── docker-compose.yml         # Local dev stack (Postgres, backend, frontend)
└── Makefile                   # Build/verify/deploy workflow
```

## Prerequisites

- Node.js >= 18
- npm
- PostgreSQL 15 (or Docker)
- Redis (for caching / ICICI session state)
- An ICICI Direct account with Breeze API credentials, if you want live broker functionality

## Getting Started

### Option 1: Docker Compose (recommended for local dev)

```bash
docker-compose up -d
```

This starts:
- **Postgres** on `localhost:5432`
- **Backend API** on `localhost:8080`
- **Frontend** on `localhost:5173`

Set `ICICI_API_KEY` and `ICICI_API_SECRET` in your shell/`.env` before starting if you want ICICI integration to work in the containerized backend.

### Option 2: Run frontend and backend separately

**Frontend**

```bash
npm install
npm run dev
```

Runs on `http://localhost:5173` by default (Vite).

**Backend**

```bash
# Start Postgres (if not already running)
docker run -d \
  --name alphaforge-db \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=alphaforge \
  -p 5432:5432 \
  postgres:15-alpine

# Initialize schema
psql -h localhost -U postgres -d alphaforge -f database/init.sql

# Install & run backend
cd backend
npm install
cp .env.example .env   # then edit with your configuration
npm run dev
```

Runs on `http://localhost:8080` (or the `PORT` set in `.env`).

See [`README.backend.md`](./README.backend.md) for the full backend API reference (auth, strategies, credentials, market data endpoints) and [`backend/ICICI_BREEZE_SETUP.md`](./backend/ICICI_BREEZE_SETUP.md) for connecting a broker account.

## Using the Makefile

The repo includes a `Makefile` that wraps common backend build/verify/deploy tasks:

```bash
make help            # list all available targets
make install-dev      # install backend dependencies
make env-verify       # verify required environment variables are set
make db-verify        # verify database connectivity/schema
make icici-verify     # verify ICICI credentials/connection
make preflight         # run all verification steps
make build             # preflight + clean build
make test              # run backend tests
make deploy-prod       # production build, test, and deploy
```

## Environment Variables

Backend configuration (see `backend/.env.example` if present, or `README.backend.md`):

```env
# Server
PORT=3000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=alphaforge
DB_USER=postgres
DB_PASSWORD=your_password

# Security
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d
CREDENTIALS_ENCRYPTION_KEY=your_32_char_encryption_key

# ICICI Direct (Breeze API)
ICICI_API_KEY=your_icici_api_key
ICICI_API_SECRET=your_icici_api_secret
ICICI_REDIRECT_URL=http://localhost:5173
ICICI_PRIMARY_IP=127.0.0.1

# AI Service (strategy generation)
PREFERRED_AI_PROVIDER=OPENROUTER
OPENROUTER_API_KEY=your_openrouter_api_key

# CORS
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

**Never commit real secrets.** Rotate any credentials that may have been exposed in commit history or logs before deploying.

## Database

- Schema lives in `database/init.sql`
- Migrations live in `database/migrations/` and can be run via `scripts/db/migrate.sh` or `make db-migrate`
- Key tables: `auth.users`, `public.strategies`, `public.user_credentials` (encrypted), `public.market_data`

## Testing

```bash
# Backend
cd backend
npm test

# Health check
curl http://localhost:8080/health
```

A Postman collection for manual API verification is available under `Verifyfiles/postman`.

## Deployment

Docker build files for staging/production are under `Verifyfiles/` (`Dockerfile_Backend`, `Dockerfile_frontend`) and `backend/Dockerfile`. Deployment scripts are in `scripts/deploy/`. Use `make deploy-prod` to run the full build → test → deploy sequence.

## License

See repository license terms (not specified in this repo — add a `LICENSE` file if one is intended).
