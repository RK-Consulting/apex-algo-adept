#!/bin/bash

# AlphaForge Database Schema Export Script
# Exports the database schema and optionally data for migration

set -e

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUTPUT_DIR="./exports"
mkdir -p "$OUTPUT_DIR"

echo "🔍 AlphaForge Database Export Utility"
echo "======================================"
echo ""

# Check if running with Supabase or standalone PostgreSQL
if [ -n "$SUPABASE_DB_URL" ]; then
    echo "📊 Detected Supabase connection"
    DB_CONNECTION="$SUPABASE_DB_URL"
else
    echo "📊 Using local PostgreSQL"
    DB_HOST="${DB_HOST:-localhost}"
    DB_PORT="${DB_PORT:-5432}"
    DB_NAME="${DB_NAME:-alphaforge}"
    DB_USER="${DB_USER:-postgres}"
    
    read -sp "Enter database password: " DB_PASSWORD
    echo ""
    
    export PGPASSWORD="$DB_PASSWORD"
    DB_CONNECTION="postgresql://$DB_USER@$DB_HOST:$DB_PORT/$DB_NAME"
fi

echo ""
echo "Exporting schema..."
pg_dump "$DB_CONNECTION" \
    --schema-only \
    --no-owner \
    --no-privileges \
    --file="$OUTPUT_DIR/schema_$TIMESTAMP.sql"

echo "✅ Schema exported to: $OUTPUT_DIR/schema_$TIMESTAMP.sql"

echo ""
read -p "Export data as well? (y/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Exporting data..."
    
    # Export strategies table
    pg_dump "$DB_CONNECTION" \
        --data-only \
        --table=public.strategies \
        --file="$OUTPUT_DIR/data_strategies_$TIMESTAMP.sql"
    
    # Export user_credentials table (encrypted)
    pg_dump "$DB_CONNECTION" \
        --data-only \
        --table=public.user_credentials \
        --file="$OUTPUT_DIR/data_credentials_$TIMESTAMP.sql"
    
    # Export recent market_data (last 7 days)
    psql "$DB_CONNECTION" -c "COPY (
        SELECT * FROM market_data 
        WHERE timestamp > NOW() - INTERVAL '7 days'
    ) TO STDOUT WITH CSV HEADER" > "$OUTPUT_DIR/data_market_$TIMESTAMP.csv"
    
    echo "✅ Data exported successfully!"
fi

echo ""
echo "📦 Export complete! Files saved in: $OUTPUT_DIR"
echo ""
echo "To import on another machine:"
echo "  1. Initialize database: psql -f $OUTPUT_DIR/schema_$TIMESTAMP.sql"
echo "  2. Import data: psql -f $OUTPUT_DIR/data_*.sql"
echo ""
