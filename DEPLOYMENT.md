# AlphaForge Deployment Guide

This guide covers all 4 deployment options for the AlphaForge trading platform.

## Architecture Overview

AlphaForge supports multiple deployment architectures:

1. **Lovable Cloud (Current)** - Fully managed Supabase backend
2. **Standalone Deployment** - Separate backend and database servers
3. **Local Development** - Docker-based local environment
4. **Traditional Backend** - Node.js/Express server with PostgreSQL

---

## Option 1: Lovable Cloud (Current Setup)

### Overview
- Backend: Supabase Edge Functions (Deno)
- Database: Supabase PostgreSQL
- Authentication: Supabase Auth
- Deployment: Automatic via Lovable

### Usage
This is the **current active setup**. No additional configuration needed.

**Pros:**
- Zero infrastructure management
- Automatic scaling
- Built-in authentication
- Real-time capabilities

**Cons:**
- Tied to Supabase/Lovable ecosystem
- Less control over infrastructure

---

## Option 2: Standalone Deployment

### Overview
Deploy backend and database on separate machines with full control.

### Prerequisites
- Two servers (backend + database) or one server with separate services
- Node.js 18+ on backend server
- PostgreSQL 12+ on database server

### Step 1: Database Server Setup

```bash
# Install PostgreSQL
sudo apt update
sudo apt install postgresql postgresql-contrib

# Create database
sudo -u postgres psql
CREATE DATABASE alphaforge;
CREATE USER alphaforge_user WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE alphaforge TO alphaforge_user;
\q

# Initialize schema
psql -U alphaforge_user -d alphaforge -f database/init.sql

# Configure PostgreSQL for remote connections
sudo nano /etc/postgresql/15/main/postgresql.conf
# Change: listen_addresses = '*'

sudo nano /etc/postgresql/15/main/pg_hba.conf
# Add: host all all 0.0.0.0/0 md5

sudo systemctl restart postgresql
```

### Step 2: Backend Server Setup

```bash
# Clone repository
git clone <your-repo-url>
cd alphaforge/backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
nano .env

# Update these values:
DB_HOST=<database-server-ip>
DB_PORT=5432
DB_NAME=alphaforge
DB_USER=alphaforge_user
DB_PASSWORD=<your_secure_password>
JWT_SECRET=<generate-strong-secret>
CREDENTIALS_ENCRYPTION_KEY=<generate-32-char-secret>
LOVABLE_API_KEY=<your-lovable-api-key>

# Build and start
npm run build
npm start

# Or use PM2 for production
npm install -g pm2
pm2 start dist/server.js --name alphaforge-backend
pm2 save
pm2 startup
```

### Step 3: Frontend Configuration

Update frontend to point to your backend:

```typescript
// src/config/api.ts
export const API_BASE_URL = process.env.VITE_API_URL || 'https://your-backend-server.com/api';

// Replace all Supabase function calls with REST API calls
// Example:
// OLD: await supabase.functions.invoke('generate-strategy', { body })
// NEW: await fetch(`${API_BASE_URL}/strategies/generate`, { 
//   method: 'POST',
//   headers: { 'Authorization': `Bearer ${token}` },
//   body: JSON.stringify(body)
// })
```

### Production Deployment

```bash
# Use NGINX as reverse proxy
sudo apt install nginx

# Configure NGINX
sudo nano /etc/nginx/sites-available/alphaforge

server {
    listen 80;
    server_name your-domain.com;

    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Enable site
sudo ln -s /etc/nginx/sites-available/alphaforge /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Setup SSL with Let's Encrypt
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

## Option 3: Local Development with Docker

### Overview
Complete local development environment using Docker Compose.

### Prerequisites
- Docker Desktop or Docker Engine + Docker Compose
- Git

### Setup

```bash
# Clone repository
git clone <your-repo-url>
cd alphaforge

# Create environment file
cp backend/.env.example backend/.env

# Update backend/.env with your API keys
nano backend/.env
# Add your LOVABLE_API_KEY

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Reset database
docker-compose down -v
docker-compose up -d
```

### Services

- **PostgreSQL**: `localhost:5432`
- **Backend API**: `http://localhost:3000`
- **Frontend**: `http://localhost:5173`

### Development Workflow

```bash
# Backend changes auto-reload via volume mount
cd backend
npm install <new-package>

# Run migrations
docker-compose exec backend npm run migrate

# Access database
docker-compose exec postgres psql -U postgres -d alphaforge

# View backend logs
docker-compose logs -f backend
```

---

## Option 4: Traditional Backend Server (Production)

### Overview
Enterprise-grade deployment with separate concerns.

### Infrastructure Requirements

**Backend Server:**
- 2+ CPU cores
- 4GB+ RAM
- Node.js 18+
- PM2 or systemd

**Database Server:**
- 2+ CPU cores
- 8GB+ RAM
- PostgreSQL 12+
- SSD storage

### Production Setup

#### Database Server

```bash
# Production PostgreSQL configuration
sudo nano /etc/postgresql/15/main/postgresql.conf

max_connections = 200
shared_buffers = 2GB
effective_cache_size = 6GB
maintenance_work_mem = 512MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 10485kB
min_wal_size = 1GB
max_wal_size = 4GB

# Setup backups
sudo crontab -e
0 2 * * * pg_dump -U alphaforge_user alphaforge | gzip > /backup/alphaforge_$(date +\%Y\%m\%d).sql.gz

# Setup replication (optional)
# Configure streaming replication for high availability
```

#### Backend Server

```bash
# Production deployment script
# deploy.sh

#!/bin/bash
set -e

echo "Pulling latest code..."
git pull origin main

echo "Installing dependencies..."
cd backend
npm ci --production

echo "Building application..."
npm run build

echo "Running database migrations..."
npm run migrate

echo "Restarting application..."
pm2 restart alphaforge-backend

echo "Deployment complete!"
```

#### Load Balancer Setup (Optional)

```bash
# For multiple backend instances
# nginx.conf

upstream backend {
    least_conn;
    server backend1.local:3000;
    server backend2.local:3000;
    server backend3.local:3000;
}

server {
    listen 443 ssl http2;
    server_name api.alphaforge.com;

    ssl_certificate /etc/letsencrypt/live/api.alphaforge.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.alphaforge.com/privkey.pem;

    location /api {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## Environment Variables Reference

### Backend (.env)

```bash
# Server
PORT=3000
NODE_ENV=production

# Database
DB_HOST=your-db-host
DB_PORT=5432
DB_NAME=alphaforge
DB_USER=alphaforge_user
DB_PASSWORD=strong-password-here

# Security
JWT_SECRET=generate-strong-64-char-secret
JWT_EXPIRES_IN=7d
CREDENTIALS_ENCRYPTION_KEY=generate-32-char-minimum-secret

# AI Service
LOVABLE_API_KEY=your-lovable-api-key

# CORS
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com

# Rate Limiting
RATE_LIMIT_WINDOW=3600000
RATE_LIMIT_MAX_REQUESTS=10
```

### Frontend (.env)

```bash
# For standalone deployment
VITE_API_URL=https://api.yourdomain.com/api

# For Lovable Cloud (current)
VITE_SUPABASE_URL=<provided-by-lovable>
VITE_SUPABASE_PUBLISHABLE_KEY=<provided-by-lovable>
```

---

## Migration from Lovable Cloud

### Step 1: Export Data

```bash
# Export Supabase database
supabase db dump > backup.sql

# Or using PostgreSQL directly
pg_dump -h <supabase-host> -U postgres -d postgres > backup.sql
```

### Step 2: Import to Your Database

```bash
psql -U alphaforge_user -d alphaforge -f backup.sql
```

### Step 3: Update Frontend

Replace all Supabase client calls with REST API calls:

```typescript
// Before (Supabase)
import { supabase } from '@/integrations/supabase/client';
const { data } = await supabase.functions.invoke('generate-strategy', { body });

// After (Standalone)
const response = await fetch(`${API_BASE_URL}/strategies/generate`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('token')}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(data)
});
const result = await response.json();
```

---

## Monitoring & Maintenance

### Health Checks

```bash
# Backend health
curl http://localhost:3000/health

# Database health
pg_isready -h localhost -p 5432
```

### Logs

```bash
# PM2 logs
pm2 logs alphaforge-backend

# Docker logs
docker-compose logs -f backend

# PostgreSQL logs
tail -f /var/log/postgresql/postgresql-15-main.log
```

### Backups

```bash
# Database backup script
#!/bin/bash
BACKUP_DIR="/backup/alphaforge"
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump -U alphaforge_user alphaforge | gzip > "$BACKUP_DIR/backup_$DATE.sql.gz"

# Keep only last 7 days
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +7 -delete
```

---

## Performance Tuning

### Database

```sql
-- Add indexes for common queries
CREATE INDEX idx_strategies_user_status ON strategies(user_id, status);
CREATE INDEX idx_market_data_lookup ON market_data(symbol, exchange, timestamp DESC);

-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM strategies WHERE user_id = 'xxx';
```

### Backend

```typescript
// Use connection pooling
// Already configured in backend/src/config/database.ts

// Enable caching for market data
import NodeCache from 'node-cache';
const cache = new NodeCache({ stdTTL: 60 });
```

---

## Security Checklist

- [ ] Change all default passwords
- [ ] Use strong JWT secrets (64+ characters)
- [ ] Enable HTTPS/TLS on all connections
- [ ] Configure firewall rules
- [ ] Enable PostgreSQL SSL connections
- [ ] Implement rate limiting
- [ ] Regular security updates
- [ ] Database backups automated
- [ ] Monitor logs for suspicious activity
- [ ] Rotate credentials regularly

---

## Support

For issues specific to:
- **Lovable Cloud**: Contact Lovable support
- **Standalone Deployment**: Check logs and GitHub issues
- **Database**: PostgreSQL documentation
- **Backend**: Node.js/Express documentation

---

## Next Steps

Choose your deployment option and follow the relevant section. For most users:

- **Development**: Use Option 3 (Docker Compose)
- **Production (Easy)**: Use Option 1 (Lovable Cloud)
- **Production (Control)**: Use Option 2 or 4 (Standalone/Traditional)

Happy deploying! 🚀
