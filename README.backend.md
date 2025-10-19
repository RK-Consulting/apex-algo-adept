# AlphaForge Backend

Standalone Node.js/Express backend server for the AlphaForge trading platform.

## Quick Start

### Option 1: Local Development (Docker)

```bash
# Start all services
docker-compose up -d

# Backend API: http://localhost:3000
# Database: localhost:5432
# Frontend: http://localhost:5173
```

### Option 2: Standalone Development

```bash
# Start PostgreSQL
docker run -d \
  --name alphaforge-db \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=alphaforge \
  -p 5432:5432 \
  postgres:15-alpine

# Initialize database
psql -h localhost -U postgres -d alphaforge -f database/init.sql

# Start backend
cd backend
npm install
cp .env.example .env
# Edit .env with your configuration
npm run dev
```

## API Endpoints

### Authentication

```bash
# Register
POST /api/auth/register
{
  "email": "user@example.com",
  "password": "securepassword"
}

# Login
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

### Strategies

```bash
# Generate strategy with AI
POST /api/strategies/generate
Authorization: Bearer <token>
{
  "name": "Momentum Strategy",
  "trading_style": "Intraday",
  "capital_allocation": 100000,
  "risk_level": "medium",
  "description": "RSI-based momentum strategy"
}

# Get all strategies
GET /api/strategies
Authorization: Bearer <token>

# Get single strategy
GET /api/strategies/:id
Authorization: Bearer <token>

# Update strategy
PUT /api/strategies/:id
Authorization: Bearer <token>
{
  "status": "active"
}

# Delete strategy
DELETE /api/strategies/:id
Authorization: Bearer <token>
```

### Credentials

```bash
# Store broker credentials
POST /api/credentials/store
Authorization: Bearer <token>
{
  "broker_name": "zerodha",
  "api_key": "your_api_key",
  "api_secret": "your_api_secret"
}

# Retrieve credentials
POST /api/credentials/retrieve
Authorization: Bearer <token>
{
  "broker_name": "zerodha"
}
```

### Market Data

```bash
# Stream market data
POST /api/market-data/stream
{
  "symbols": [
    { "symbol": "RELIANCE", "exchange": "NSE" },
    { "symbol": "TCS", "exchange": "NSE" }
  ]
}

# Get historical data
GET /api/market-data/history/RELIANCE?exchange=NSE&limit=100
```

## Architecture

```
backend/
├── src/
│   ├── server.ts              # Main application entry
│   ├── config/
│   │   └── database.ts        # PostgreSQL connection pool
│   ├── middleware/
│   │   ├── auth.ts            # JWT authentication
│   │   ├── errorHandler.ts   # Global error handler
│   │   └── logger.ts          # Request logging
│   └── routes/
│       ├── auth.ts            # Auth endpoints
│       ├── strategies.ts      # Strategy management
│       ├── credentials.ts     # Broker credentials
│       └── marketData.ts      # Market data streaming
├── package.json
└── tsconfig.json

database/
├── init.sql                   # Database schema
└── export-schema.sh          # Export utility
```

## Environment Variables

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

# AI Service
LOVABLE_API_KEY=your_lovable_api_key

# CORS
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

## Development

```bash
# Watch mode
npm run dev

# Build
npm run build

# Production
npm start

# Run migrations
npm run migrate
```

## Deployment

See [DEPLOYMENT.md](../DEPLOYMENT.md) for comprehensive deployment guides covering:
- Standalone deployment
- Docker deployment
- Production setup
- Migration from Lovable Cloud

## Key Features

✅ **PostgreSQL Compatible** - Pure PostgreSQL, no vendor lock-in
✅ **Secure Credentials** - AES-256-GCM encryption for API keys
✅ **JWT Authentication** - Stateless authentication
✅ **Rate Limiting** - Protection against abuse
✅ **AI Integration** - Lovable AI for strategy generation
✅ **Type Safety** - Full TypeScript support
✅ **Production Ready** - Error handling, logging, health checks

## Database Schema

### Tables

- `auth.users` - User accounts
- `public.strategies` - Trading strategies
- `public.user_credentials` - Encrypted broker credentials
- `public.market_data` - Real-time market data

### Migrations

```bash
# Run all migrations
npm run migrate

# Create new migration
cat > database/migrations/$(date +%s)_description.sql << EOF
-- Your SQL here
EOF
```

## Testing

```bash
# Health check
curl http://localhost:3000/health

# Test auth
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'

# Test with auth token
TOKEN="your_jwt_token"
curl http://localhost:3000/api/strategies \
  -H "Authorization: Bearer $TOKEN"
```

## Security

- JWT tokens with configurable expiration
- Bcrypt password hashing (10 rounds)
- AES-256-GCM credential encryption
- CORS protection
- Rate limiting per user
- SQL injection prevention (parameterized queries)
- XSS protection (helmet middleware recommended)

## Performance

- Connection pooling (max 20 connections)
- Database query logging
- Indexed queries on common lookups
- Stateless authentication (no session storage)

## Troubleshooting

### Database connection failed
```bash
# Check PostgreSQL is running
docker ps | grep postgres
# or
systemctl status postgresql

# Test connection
psql -h localhost -U postgres -d alphaforge
```

### JWT token errors
```bash
# Verify JWT_SECRET is set
echo $JWT_SECRET

# Check token expiration
# Tokens expire based on JWT_EXPIRES_IN setting
```

### CORS errors
```bash
# Add your frontend URL to ALLOWED_ORIGINS
ALLOWED_ORIGINS=http://localhost:5173,https://yourdomain.com
```

## License

Same as main project

## Support

For backend-specific issues, check:
1. Console logs: `docker-compose logs -f backend`
2. Database logs: `docker-compose logs -f postgres`
3. [DEPLOYMENT.md](../DEPLOYMENT.md) for deployment guides
