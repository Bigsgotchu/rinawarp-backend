# 🚀 RinaWarp Terminal Pro - Backend API

Production-ready Express backend for RinaWarp Terminal Pro with Stripe payments, AI integration, and license management.

---

## 📋 Overview

This backend provides:
- 💳 **Stripe Integration** - Checkout sessions and webhook handling
- 🧠 **AI Routes** - Multi-model AI orchestration
- 🔐 **License Management** - JWT-based license validation
- 🖥️ **CLI Integration** - Terminal command processing
- 🛡️ **Security** - Helmet, CORS, rate limiting

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Backend Structure                     │
└─────────────────────────────────────────────────────────┘

server.js (Main Entry Point)
    │
    ├─── middleware/
    │    ├─── checkLicense.js      (License validation)
    │    ├─── license-mw.js        (License middleware)
    │    └─── test-license-bypass.js (Testing)
    │
    ├─── routes/
    │    ├─── ai.js                (AI endpoints)
    │    ├─── cli.js               (CLI commands)
    │    ├─── license.js           (License CRUD)
    │    ├─── stripe-production.js (Checkout)
    │    └─── stripe-webhook.js    (Webhooks)
    │
    └─── utils/
         └─── logger.js            (Logging)
```

---

## 🚀 Quick Start

### Local Development

```bash
# Install dependencies
npm install

# Start server
npm start

# Development with auto-reload
npm run dev
```

Server runs on: `http://localhost:3001` (or `PORT` from env)

### Production Deployment

See deployment guides in project root:
- `DEPLOYMENT-QUICK-START.md` - Fast 15-min guide
- `RENDER-DEPLOYMENT-GUIDE.md` - Detailed walkthrough
- `BACKEND-DEPLOYMENT-CHECKLIST.md` - Progress tracker

---

## 🔌 API Endpoints

### Health Check
```
GET /api/health
```
Returns server status and uptime.

### Stripe Routes
```
POST /api/stripe/checkout        # Create checkout session
POST /api/stripe/webhook         # Handle Stripe webhooks
```

### License Routes
```
GET  /api/license/validate       # Validate license key
POST /api/license/activate       # Activate license
GET  /api/license/status         # Check license status
```

### AI Routes
```
POST /api/ai/chat               # AI chat completion
POST /api/ai/command            # AI command generation
```

### CLI Routes
```
POST /api/cli/execute           # Execute CLI command
GET  /api/cli/history           # Get command history
```

---

## ⚙️ Environment Variables

### Required

```bash
NODE_ENV=production
PORT=10000

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# URLs
STRIPE_SUCCESS_URL=https://rinawarptech.com/success
STRIPE_CANCEL_URL=https://rinawarptech.com/pricing

# CORS
CORS_ORIGINS=https://rinawarptech.com,https://www.rinawarptech.com
```

### Optional

```bash
# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=120

# License
LICENSE_ISSUER=RinaWarp
LICENSE_SIGNING_PRIVATE_KEY_PATH=/path/to/key.pem
```

---

## 🔒 Security Features

- **Helmet.js** - Security headers
- **CORS** - Cross-origin resource sharing
- **Rate Limiting** - Request throttling
- **Webhook Verification** - Stripe signature validation
- **Input Validation** - Request sanitization
- **Error Handling** - Graceful error responses

---

## 📊 Monitoring

### Health Check
```bash
curl http://localhost:3001/api/health
```

### Logs
Server logs include:
- Request/response cycles
- Stripe webhook events
- License operations
- Error tracking

---

## 🧪 Testing

### Test Stripe Webhook Locally

1. Install Stripe CLI:
```bash
brew install stripe/stripe-cli/stripe
```

2. Forward webhooks:
```bash
stripe listen --forward-to localhost:3001/api/stripe/webhook
```

3. Trigger test event:
```bash
stripe trigger checkout.session.completed
```

### Test Endpoints

```bash
# Health check
curl http://localhost:3001/api/health

# Create checkout (requires valid price ID)
curl -X POST http://localhost:3001/api/stripe/checkout \
  -H "Content-Type: application/json" \
  -d '{"priceId":"price_xxx","email":"test@example.com"}'
```

---

## 📦 Dependencies

### Core
- `express` - Web framework
- `cors` - CORS middleware
- `helmet` - Security headers
- `dotenv` - Environment variables

### Payments
- `stripe` - Stripe SDK

### AI
- `openai` - OpenAI SDK

### Utilities
- `chalk` - Terminal colors
- `ws` - WebSocket support

### Development
- `nodemon` - Auto-reload

---

## 🔄 Deployment

### Render (Recommended)

```bash
# 1. Push to GitHub
git push origin main

# 2. Deploy on Render
# - Connect GitHub repo
# - Set environment variables
# - Deploy!
```

### Manual Deployment

```bash
# 1. Install dependencies
npm install --production

# 2. Set environment variables
export NODE_ENV=production
export PORT=10000
# ... (set all required vars)

# 3. Start server
node server.js
```

---

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Kill process on port
npm run kill

# Or manually
kill -9 $(lsof -t -i:3001)
```

### Webhook Signature Failed
- Verify `STRIPE_WEBHOOK_SECRET` matches Stripe dashboard
- Ensure raw body parsing for webhook route
- Check webhook endpoint URL

### CORS Errors
- Add frontend domain to `CORS_ORIGINS`
- Verify protocol (http vs https)
- Check for trailing slashes

---

## 📚 Documentation

- **API Docs**: See `/docs/API.md` (if available)
- **Deployment**: See project root deployment guides
- **Stripe**: https://stripe.com/docs
- **Express**: https://expressjs.com

---

## 🤝 Contributing

1. Create feature branch
2. Make changes
3. Test locally
4. Submit pull request

---

## 📄 License

Copyright © 2025 RinaWarp Technologies, LLC

---

## 🆘 Support

- **Email**: support@rinawarptech.com
- **Docs**: https://rinawarptech.com/docs
- **Status**: https://status.rinawarptech.com

---

**Status**: ✅ Production Ready
**Version**: 1.0.0
**Last Updated**: January 2025
