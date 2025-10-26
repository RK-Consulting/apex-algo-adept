# ICICI Direct Breeze API Integration

This document explains how to connect and use ICICI Direct broker through the Breeze API.

## Overview

The AlphaForge backend now supports ICICI Direct trading through their official Breeze API. All credentials are encrypted and stored securely.

## Getting Started

### 1. Obtain API Credentials

1. Login to your ICICI Direct account
2. Navigate to API settings to generate:
   - **API Key** (App Key)
   - **API Secret** (App Secret)

### 2. Connect via Frontend

1. Go to **Settings** → **Broker** tab
2. Click **Connect** on the ICICI Direct card
3. Enter your **API Key** and **API Secret**
4. Click **Get Session Token** - this will open ICICI's login page
5. Login with your ICICI credentials
6. Copy the session token from the URL after successful login
7. Paste the session token and click **Connect**

The backend will:
- Test the connection
- Encrypt and store your credentials
- Confirm successful connection

## Available API Endpoints

All endpoints require authentication via JWT token in the `Authorization` header.

### Connection

**POST** `/api/icici/connect`
```json
{
  "api_key": "your_api_key",
  "api_secret": "your_api_secret",
  "session_token": "your_session_token"
}
```

### Get Account Funds

**GET** `/api/icici/funds`

Returns your account balance and available margin.

### Get Holdings

**GET** `/api/icici/holdings`

Query Parameters:
- `exchange_code` (default: "NSE")
- `from_date`
- `to_date`
- `stock_code`
- `portfolio_type`

### Place Order

**POST** `/api/icici/order`
```json
{
  "stock_code": "RELIANCE",
  "exchange_code": "NSE",
  "product": "cash",
  "action": "buy",
  "order_type": "market",
  "quantity": "1",
  "price": "0",
  "validity": "day",
  "stoploss": "0",
  "disclosed_quantity": "0"
}
```

### Get Order List

**GET** `/api/icici/orders`

Query Parameters:
- `exchange_code` (default: "NSE")
- `from_date`
- `to_date`

### Get Stock Quotes

**GET** `/api/icici/quotes`

Query Parameters (required):
- `stock_code` (e.g., "RELIANCE")
- `exchange_code` (e.g., "NSE")

### Cancel Order

**DELETE** `/api/icici/order/:orderId`

Body:
```json
{
  "exchange_code": "NSE"
}
```

### Get Historical Data

**GET** `/api/icici/historical`

Query Parameters (all required):
- `interval` (e.g., "1minute", "5minute", "1day")
- `from_date` (YYYY-MM-DD)
- `to_date` (YYYY-MM-DD)
- `stock_code`
- `exchange_code`
- `product_type` (optional, default: "cash")

## Security Features

1. **Encryption at Rest**: All credentials (API key, secret, session token) are encrypted using AES-256-GCM
2. **Key Derivation**: Uses PBKDF2 with 100,000 iterations for key derivation
3. **Secure Storage**: Credentials stored in PostgreSQL with unique constraint per user
4. **Connection Testing**: Backend validates connection before storing credentials

## Session Token Notes

- Session tokens expire after some time (typically 24 hours)
- You'll need to regenerate the session token periodically
- The backend stores the encrypted session token for convenience
- When a session expires, reconnect through the Settings page

## Example Frontend Usage

```typescript
// Get funds
const response = await fetch(`${backendUrl}/api/icici/funds`, {
  headers: {
    'Authorization': `Bearer ${accessToken}`,
  },
});
const { data } = await response.json();

// Place order
const orderResponse = await fetch(`${backendUrl}/api/icici/order`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`,
  },
  body: JSON.stringify({
    stock_code: 'RELIANCE',
    exchange_code: 'NSE',
    action: 'buy',
    quantity: '1',
    order_type: 'market',
  }),
});
```

## Troubleshooting

### "Failed to connect to ICICI Direct"
- Verify your API credentials are correct
- Ensure session token is valid and not expired
- Check if you've completed the login flow correctly

### "Credentials not found"
- Reconnect through Settings → Broker tab
- Ensure you've successfully stored credentials

### Session Expired Errors
- Session tokens expire regularly
- Generate a new session token from: `https://api.icicidirect.com/apiuser/login?api_key=YOUR_API_KEY`
- Reconnect through the Settings page with the new session token

## API Documentation

For complete Breeze API documentation, visit:
- [Breeze HTTP API Docs](https://api.icicidirect.com/breezeapi/documents/index.html)
- [NPM Package](https://www.npmjs.com/package/breezeconnect)

## Database Schema

The `user_credentials` table includes:
- `session_token` TEXT field for storing encrypted session tokens
- Unique constraint on (user_id, broker_name) to prevent duplicates

Migration is required if upgrading from older schema without session_token field.
