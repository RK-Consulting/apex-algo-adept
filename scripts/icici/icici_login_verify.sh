#!/bin/bash

# ============================================
# AlphaForge ICICI Runtime Verification
# ============================================

API="https://api.alphaforge.skillsifter.in"
TOKEN="$1"

if [ -z "$TOKEN" ]; then
  echo "❌ Usage: ./icici_login_verify.sh <JWT_TOKEN>"
  exit 1
fi

echo "============================================"
echo "1️⃣ ICICI STATUS CHECK"
echo "============================================"
curl -s "$API/api/icici/status" \
  -H "Authorization: Bearer $TOKEN" | jq .

echo
echo "============================================"
echo "2️⃣ ICICI PROFILE (BREEZE SANITY)"
echo "============================================"
curl -s "$API/api/icici/profile" \
  -H "Authorization: Bearer $TOKEN" | jq .

echo
echo "============================================"
echo "3️⃣ ICICI ORDERS (LIGHT READ)"
echo "============================================"
curl -s "$API/api/icici/orders?limit=1" \
  -H "Authorization: Bearer $TOKEN" | jq .
