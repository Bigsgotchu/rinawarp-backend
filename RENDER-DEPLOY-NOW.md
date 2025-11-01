# 🚀 Deploy to Render NOW - 5 Minute Guide

Your code is live on GitHub! Let's get it deployed to Render.

## 📍 Your GitHub Repository
**https://github.com/Bigsgotchu/rinawarp-backend**

---

## ⚡ Quick Deploy Steps

### 1️⃣ Sign Up for Render (30 seconds)
👉 **https://render.com**
- Click **"Get Started"**
- Sign in with **GitHub** (use account: **Bigsgotchu**)

### 2️⃣ Create Web Service (1 minute)
1. Click **"New +"** → **"Web Service"**
2. Find and select: **`rinawarp-backend`**
3. Click **"Connect"**

### 3️⃣ Configure Service (2 minutes)

**Basic Settings:**
```
Name: rinawarp-backend
Region: Oregon (US West)
Branch: main
Root Directory: backend
Runtime: Node
```

**Build & Start:**
```
Build Command: npm install
Start Command: node server.js
```

**Instance Type:**
```
Free
```

### 4️⃣ Add Environment Variables (2 minutes)

Click **"Advanced"** → **"Add Environment Variable"**

**Copy-paste these:**
```bash
NODE_ENV=production
PORT=10000
CORS_ORIGINS=https://rinawarptech.com,https://www.rinawarptech.com
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=120
LICENSE_ISSUER=RinaWarp
```

**🔐 Add Your Stripe Keys:**

Open `backend/.env` and copy your keys:
```bash
STRIPE_SECRET_KEY=sk_live_xxxxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
STRIPE_SUCCESS_URL=https://rinawarptech.com/success
STRIPE_CANCEL_URL=https://rinawarptech.com/downloads
```

### 5️⃣ Deploy! (30 seconds)
1. Click **"Create Web Service"**
2. Wait for build to complete (2-3 minutes)
3. Copy your live URL: `https://rinawarp-backend.onrender.com`

---

## ✅ Verify Deployment

Test your backend is live:
```bash
curl https://rinawarp-backend.onrender.com/health
```

Should return:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-31T...",
  "uptime": 123.45,
  "version": "1.0.0",
  "environment": "production"
}
```

---

## 🔗 Update Your Website

### Edit: `website/downloads.html`

Find (around line 450):
```javascript
const backendUrl = 'http://localhost:3001';
```

Replace with:
```javascript
const backendUrl = 'https://rinawarp-backend.onrender.com';
```

### Redeploy Website:
```bash
cd ~/Documents/RinaWarp-Terminal-Pro
npm run deploy:website
```

---

## 🎯 Configure Stripe Webhooks

### In Stripe Dashboard:
1. Go to: **https://dashboard.stripe.com/webhooks**
2. Click **"Add endpoint"**
3. Enter: `https://rinawarp-backend.onrender.com/api/stripe/webhook`
4. Select events:
   - ✅ `checkout.session.completed`
   - ✅ `payment_intent.succeeded`
   - ✅ `customer.subscription.created`
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`
5. Click **"Add endpoint"**
6. Copy the **Signing Secret** (starts with `whsec_`)
7. Add to Render: **Environment** → **STRIPE_WEBHOOK_SECRET**

---

## 🎊 You're Live!

Once complete:
- ✅ Backend running at: `https://rinawarp-backend.onrender.com`
- ✅ Stripe checkout working end-to-end
- ✅ Webhooks delivering payment confirmations
- ✅ Ready to accept real payments!

---

## 📊 Monitor Your Backend

**Render Dashboard:**
- **Logs**: Real-time server logs
- **Metrics**: CPU, memory, response times
- **Events**: Deployment history

**Stripe Dashboard:**
- **Payments**: View all transactions
- **Webhooks**: Monitor webhook deliveries

---

## 🔄 Future Updates

To update your backend:
```bash
cd ~/Documents/RinaWarp-Terminal-Pro
git add .
git commit -m "Update backend"
git push origin main
```

Render auto-deploys on push! 🎉

---

## 🆘 Need Help?

**Common Issues:**

**Build failing?**
- Check Render logs for errors
- Verify `backend/package.json` exists
- Ensure Node version compatibility

**Stripe not working?**
- Verify all environment variables are set
- Check webhook signing secret matches
- Test with Stripe CLI: `stripe listen --forward-to https://rinawarp-backend.onrender.com/api/stripe/webhook`

**CORS errors?**
- Ensure `CORS_ORIGINS` includes your domain
- Check browser console for specific errors

---

## 📚 Full Documentation

- `BACKEND-DEPLOYMENT-SUCCESS.md` - Complete guide
- `GITHUB-RENDER-DEPLOYMENT.md` - Detailed deployment steps
- `QUICK-DEPLOY-COMMANDS.md` - Command reference

---

**🚀 Ready to deploy? Go to: https://render.com**
