-- AlphaForge Database Schema
-- Compatible with PostgreSQL 12+
-- ======================================================
--  AlphaForge / Apex Algo Adept PostgreSQL Initialization
-- ======================================================
-- Run this only once to initialize your database
-- Compatible with psql or docker-entrypoint-initdb.d
-- ======================================================
-- Create auth schema for user management
 
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS user_credentials (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  icici_api_key TEXT,
  icici_api_secret TEXT,
  icici_session_token TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

---------------------------------------------------------
-- 1️⃣ USERS TABLE (Auth)
---------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

---------------------------------------------------------
-- 2️⃣ ICICI / BROKER CREDENTIALS TABLE
---------------------------------------------------------
CREATE TABLE IF NOT EXISTS broker_credentials (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    broker_name VARCHAR(100) NOT NULL DEFAULT 'ICICI',
    app_key VARCHAR(255) NOT NULL,
    app_secret VARCHAR(255) NOT NULL,
    session_token TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    last_connected TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broker_user ON broker_credentials(user_id);

---------------------------------------------------------
-- 3️⃣ STRATEGIES TABLE
---------------------------------------------------------
CREATE TABLE IF NOT EXISTS strategies (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    entry_condition JSONB,
    exit_condition JSONB,
    risk_management JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_strategies_user ON strategies(user_id);

---------------------------------------------------------
-- 4️⃣ MARKET DATA LOGS TABLE (Real-Time Data)
---------------------------------------------------------
CREATE TABLE IF NOT EXISTS market_data (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(50) NOT NULL,
    exchange VARCHAR(20) DEFAULT 'NSE',
    price NUMERIC(12,2),
    change NUMERIC(12,2),
    change_percent NUMERIC(8,2),
    volume BIGINT,
    open NUMERIC(12,2),
    high NUMERIC(12,2),
    low NUMERIC(12,2),
    previous_close NUMERIC(12,2),
    timestamp TIMESTAMP DEFAULT NOW(),
    inserted_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_data_symbol ON market_data(symbol);
CREATE INDEX IF NOT EXISTS idx_market_data_timestamp ON market_data(timestamp);

---------------------------------------------------------
-- 5️⃣ ORDERS TABLE (Executed / Placed Orders)
---------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    broker VARCHAR(50) DEFAULT 'ICICI',
    order_id VARCHAR(100),
    stock_code VARCHAR(50),
    exchange_code VARCHAR(20),
    product VARCHAR(50),
    action VARCHAR(10),
    order_type VARCHAR(20),
    quantity INT,
    price NUMERIC(12,2),
    status VARCHAR(50) DEFAULT 'pending',
    placed_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_stock ON orders(stock_code);

---------------------------------------------------------
-- 6️⃣ TRADE HISTORY TABLE
---------------------------------------------------------
CREATE TABLE IF NOT EXISTS trades (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT REFERENCES orders(id) ON DELETE CASCADE,
    trade_time TIMESTAMP DEFAULT NOW(),
    execution_price NUMERIC(12,2),
    quantity INT,
    trade_value NUMERIC(14,2),
    remarks TEXT
);

---------------------------------------------------------
-- 7️⃣ API LOGS / AUDIT TRAIL
---------------------------------------------------------
CREATE TABLE IF NOT EXISTS api_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    endpoint VARCHAR(255),
    request_method VARCHAR(10),
    status_code INT,
    duration_ms INT,
    created_at TIMESTAMP DEFAULT NOW(),
    metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_logs_user ON api_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_logs_endpoint ON api_logs(endpoint);

---------------------------------------------------------
-- 8️⃣ DEFAULT ADMIN USER (Optional)
---------------------------------------------------------
DO $$
DECLARE
    admin_exists BOOLEAN;
BEGIN
    SELECT EXISTS(SELECT 1 FROM users WHERE email = 'admin@alphaforge.in') INTO admin_exists;
    IF NOT admin_exists THEN
        INSERT INTO users (email, password_hash, full_name, role)
        VALUES (
            'admin@alphaforge.in',
            '$2a$10$1Z2M.6uA2XbXfCjCjCIOwO0ltHk9D0IXmM/4hZ3L2S/6/4N7CQKXm', -- bcrypt hash for 'Admin@123'
            'System Admin',
            'admin'
        );
        RAISE NOTICE '✅ Default admin created: admin@alphaforge.in / Admin@123';
    END IF;
END $$;

---------------------------------------------------------
-- END OF INIT SCRIPT
---------------------------------------------------------
