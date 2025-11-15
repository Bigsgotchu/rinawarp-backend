#!/bin/sh
set -e

echo "🚀 Manual backend startup with explicit env loading"

# Load environment manually
export DATABASE_URL="postgresql://postgres.jbxymbqatiedjrzfwidf:6YAc8HKyXUEDefJfrf1MNBgnt@aws-1-us-east-2.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require"
export JWT_SECRET="Sx8dP2TtVFuLJMbKStpUyyNBBZmEUtSMPQMme2VGifS"
export COOKIE_SECRET="hbrCwzaFkrPL8hWHI1hWiWqkr"
export APP_SECRET="CyYyRysm8j0MQBk0LQat1pO9hQIwxOne"

# Temporary test Stripe key
export STRIPE_API_KEY="sk_test_placeholder"
export STRIPE_WEBHOOK_SECRET="whsec_YOUR_NEW_WEBHOOK_SECRET_HERE"
export STRIPE_PUBLISHABLE_KEY="pk_test_YOUR_NEW_PUBLISHABLE_KEY_HERE"

export NODE_ENV=production
export PORT=8080
export DOMAIN="https://rinawarptech.com"
export CORS_ORIGINS="https://rinawarptech.com,http://localhost:5173"
export LOG_LEVEL=info

echo "✅ Environment variables loaded manually"
echo "✅ STRIPE_API_KEY loaded (showing first 20 chars)"
echo "✅ PORT: $PORT"

# Start server
echo "🚀 Starting server..."
node server.js