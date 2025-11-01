122
# 🚀 GitHub + Render Deployment Guide

## Quick Deploy: RinaWarp Backend to Production

This guide will get your backend live in **under 10 minutes**.

---

## ✅ Prerequisites Checklist

- [x] Stripe CLI installed (v1.31.0)
- [x] Stripe keys recovered and in `backend/.env`
- [x] Git initialized in project
- [ ] GitHub CLI installed (installing now...)
- [ ] GitHub account (create at https://github.com/signup if needed)
- [ ] Render account (create at https://render.com if needed)

---

## 📋 Step 1: Install GitHub CLI (In Progress)

The installation command is running. Once complete, verify with:

```bash
gh --version
```

---

## 🔐 Step 2: Authenticate with GitHub

Once GitHub CLI is installed, run:

```bash
gh auth login
```

Follow the prompts:
1. Choose: **GitHub.com**
2. Choose: **HTTPS**
3. Choose: **Login with a web browser**
4. Copy the one-time code shown
5. Press Enter to open browser
6. Paste the code and authorize

---

## 📦 Step 3: Create GitHub Repository

Run this single command to create and push your repo:

```bash
cd ~/Documents/RinaWarp-Terminal-Pro
gh repo create RinaWarp-Backend --public --source=. --remote=origin --push
```

This will:
- ✅ Create `RinaWarp-Backend` repository on GitHub
- ✅ Set it as your remote origin
- ✅ Push all your code automatically
- ✅ Open the repo in your browser

**Alternative (if you prefer private repo):**
```bash
gh repo create RinaWarp-Backend --private --source=. --remote=origin --push
```

---

## 🌐 Step 4: Deploy to Render

### Option A: Via Render Dashboard (Recommended for First Time)

1. **Go to Render Dashboard**
   ```
   https://dashboard.render.com
   ```

2. **Click "New +" → "Web Service"**

3. **Connect GitHub**
   - Click "Connect GitHub"
   - Authorize Render
   - Select `RinaWarp-Backend` repository

4. **Configure Service**
   ```
   Name: rinawarp-backend
   Region: Oregon (US West)
   Branch: main
   Root Directory: backend
   Runtime: Node
   Build Command: npm install
   Start Command: node server.js
   Instance Type: Free
   ```

5. **Add Environment Variables**
   
   Click "Advanced" → "Add Environment Variable" for each:
   
   ```bash
   NODE_ENV=production
   PORT=10000
   CORS_ORIGINS=https://rinawarptech.com,https://www.rinawarptech.com
   
   # Copy these from your backend/.env file:
   STRIPE_SECRET_KEY=sk_live_51SH4C2GZrRdZy3W9...
   STRIPE_PUBLISHABLE_KEY=pk_live_51SH4C2GZrRdZy3W9...
   STRIPE_WEBHOOK_SECRET=whsec_8dd90aa311dce345...
   
   # Stripe URLs (update after deployment):
   STRIPE_SUCCESS_URL=https://rinawarptech.com/success
   STRIPE_CANCEL_URL=https://rinawarptech.com/pricing
   
   # License signing (optional for now):
   LICENSE_ISSUER=RinaWarp
   LICENSE_SIGNING_PRIVATE_KEY_PATH=/etc/secrets/license_private.pem
   
   # Rate limiting:
   RATE_LIMIT_WINDOW_MS=60000
   RATE_LIMIT_MAX=120
   ```

6. **Click "Create Web Service"**

7. **Wait for Deployment** (2-3 minutes)
   - Watch the build logs
   - Once you see "Live", your backend is deployed!

8. **Copy Your Backend URL**
   ```
   https://rinawarp-backend.onrender.com
   ```

---

### Option B: Via Render CLI (Advanced)

If you have Render API key:

```bash
export RENDER_API_KEY=rnd_your_api_key_here
./scripts/deploy-backend-automated.sh
```

---

## 🔧 Step 5: Update Frontend

Once deployed, update your website to use the new backend URL:

```bash
# Edit website/downloads.html
nano website/downloads.html
```

Find and replace:
```javascript
// OLD:
const backendUrl = 'http://localhost:3001';

// NEW:
const backendUrl = 'https://rinawarp-backend.onrender.com';
```

Then redeploy your website:
```bash
npm run deploy:website
```

---

## 🎯 Step 6: Configure Stripe Webhooks

1. **Go to Stripe Dashboard**
   ```
   https://dashboard.stripe.com/webhooks
   ```

2. **Click "Add endpoint"**

3. **Enter your webhook URL:**
   ```
   https://rinawarp-backend.onrender.com/api/stripe/webhook
   ```

4. **Select events to listen to:**
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`

5. **Click "Add endpoint"**

6. **Copy the Webhook Signing Secret**
   - Click on your new webhook
   - Click "Reveal" next to "Signing secret"
   - Copy the `whsec_...` value

7. **Update Render Environment Variable**
   - Go back to Render dashboard
   - Click your service → "Environment"
   - Update `STRIPE_WEBHOOK_SECRET` with the new value
   - Click "Save Changes"
   - Service will auto-redeploy

---

## ✅ Step 7: Test Your Deployment

### Test Health Endpoint
```bash
curl https://rinawarp-backend.onrender.com/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-31T...",
  "uptime": 123.45,
  "version": "1.0.0",
  "environment": "production"
}
```

### Test Stripe Checkout
```bash
curl -X POST https://rinawarp-backend.onrender.com/api/stripe/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "priceId": "price_1234567890",
    "email": "test@example.com",
    "mode": "payment"
  }'
```

Expected response:
```json
{
  "ok": true,
  "url": "https://checkout.stripe.com/c/pay/cs_test_..."
}
```

---

## 🎉 Success Checklist

- [ ] GitHub CLI installed and authenticated
- [ ] Repository created on GitHub
- [ ] Code pushed to GitHub
- [ ] Render service created and deployed
- [ ] Environment variables configured
- [ ] Backend URL obtained
- [ ] Frontend updated with new backend URL
- [ ] Stripe webhooks configured
- [ ] Health endpoint tested
- [ ] Checkout endpoint tested

---

## 🔍 Troubleshooting

### Build Fails on Render

**Check logs in Render dashboard:**
- Look for missing dependencies
- Verify `package.json` is correct
- Ensure `node_modules` is not in Git

**Common fixes:**
```bash
# Locally test the build
cd backend
npm install
node server.js
```

### Environment Variables Not Working

**Verify in Render dashboard:**
1. Go to your service
2. Click "Environment"
3. Check all variables are set
4. Click "Save Changes" to trigger redeploy

### Stripe Webhooks Failing

**Check webhook signature:**
1. Verify `STRIPE_WEBHOOK_SECRET` matches Stripe dashboard
2. Check Render logs for webhook errors
3. Test webhook with Stripe CLI:
   ```bash
   stripe listen --forward-to https://rinawarp-backend.onrender.com/api/stripe/webhook
   ```

### CORS Errors

**Update CORS_ORIGINS:**
```bash
# In Render environment variables:
CORS_ORIGINS=https://rinawarptech.com,https://www.rinawarptech.com,https://yourdomain.com
```

---

## 📚 Additional Resources

- **Render Docs**: https://render.com/docs
- **GitHub CLI Docs**: https://cli.github.com/manual/
- **Stripe Webhooks**: https://stripe.com/docs/webhooks
- **RinaWarp Backend README**: `backend/README.md`

---

## 🆘 Need Help?

If you encounter issues:

1. **Check Render logs**: Dashboard → Your Service → Logs
2. **Check GitHub Actions**: (if using CI/CD)
3. **Test locally first**: `cd backend && npm start`
4. **Review environment variables**: Ensure all are set correctly

---

## 🎯 Next Steps After Deployment

1. **Set up custom domain** (optional):
   - Add CNAME in Cloudflare: `api.rinawarptech.com` → `rinawarp-backend.onrender.com`
   - Add custom domain in Render dashboard

2. **Enable auto-deploy**:
   - Already enabled by default with GitHub connection
   - Every push to `main` branch will auto-deploy

3. **Monitor your service**:
   - Check Render dashboard for uptime
   - Set up alerts for downtime
   - Monitor Stripe webhook deliveries

4. **Scale if needed**:
   - Upgrade from Free tier if you need:
     - More than 750 hours/month
     - Faster cold starts
     - More memory/CPU

---

**🚀 Your backend is now live and ready to process payments!**
