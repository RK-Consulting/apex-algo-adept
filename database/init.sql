-- ======================================================
-- AlphaForge / Apex Algo Adept — PostgreSQL Schema
-- FINAL (Broker-based architecture)
-- ======================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

---------------------------------------------------------
-- 1️⃣ USERS TABLE
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
-- 2️⃣ BROKER CREDENTIALS (PRIMARY SOURCE)
-- One row per user per broker
---------------------------------------------------------
CREATE TABLE IF NOT EXISTS broker_credentials (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    broker_name VARCHAR(100) NOT NULL,
    app_key VARCHAR(255) NOT NULL,
    app_secret VARCHAR(255) NOT NULL,
    session_token TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    last_connected TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (user_id, broker_name)
);

CREATE INDEX IF NOT EXISTS idx_broker_user ON broker_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_broker_name ON broker_credentials(broker_name);

---------------------------------------------------------
-- 3️⃣ ICICI SESSIONS (RUNTIME ONLY)
-- No credentials stored here
---------------------------------------------------------
CREATE TABLE IF NOT EXISTS icici_sessions (
    id SERIAL PRIMARY KEY,
    idirect_userid UUID REFERENCES users(id) ON DELETE CASCADE,
    session_token TEXT NOT NULL,
    username TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (idirect_userid)
);

---------------------------------------------------------
-- 4️⃣ STRATEGIES
---------------------------------------------------------
CREATE TABLE IF NOT EXISTS strategies (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    entry_condition JSONB,
    exit_condition JSONB,
    risk_management JSONB,
    performance_data JSONB,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_strategies_user ON strategies(user_id);

---------------------------------------------------------
-- 5️⃣ MARKET TICKS
---------------------------------------------------------
CREATE TABLE IF NOT EXISTS market_ticks (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(50) NOT NULL,
    exchange VARCHAR(20) DEFAULT 'NSE',
    last_price NUMERIC(12,2),
    open NUMERIC(12,2),
    high NUMERIC(12,2),
    low NUMERIC(12,2),
    volume BIGINT,
    timestamp TIMESTAMP DEFAULT NOW(),
    inserted_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticks_symbol ON market_ticks(symbol);
CREATE INDEX IF NOT EXISTS idx_ticks_timestamp ON market_ticks(timestamp);

---------------------------------------------------------
-- 6️⃣ ORDERS
---------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    broker VARCHAR(50) DEFAULT 'ICICI',
    order_id VARCHAR(100),
    stock_code VARCHAR(50),
    exchange_code VARCHAR(20),
    product_type VARCHAR(50),
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
-- 7️⃣ TRADES
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
-- 8️⃣ API LOGS / AUDIT
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
-- 9️⃣ DEFAULT ADMIN (OPTIONAL)
---------------------------------------------------------
DO $$
DECLARE
    admin_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM users WHERE email = 'admin@alphaforge.in'
    ) INTO admin_exists;

    IF NOT admin_exists THEN
        INSERT INTO users (email, password_hash, full_name, role)
        VALUES (
            'admin@alphaforge.in',
            '$2a$10$1Z2M.6uA2XbXfCjCjCIOwO0ltHk9D0IXmM/4hZ3L2S/6/4N7CQKXm',
            'System Admin',
            'admin'
        );
    END IF;
END $$;

-- END OF SCHEMA
