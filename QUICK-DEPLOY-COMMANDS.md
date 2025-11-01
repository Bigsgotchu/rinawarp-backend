na12122
# ⚡ Quick Deploy Commands

Copy and paste these commands in order once GitHub CLI is installed.

---

## 1️⃣ Verify GitHub CLI Installation

```bash
gh --version
```

Expected output: `gh version 2.x.x`

---

## 2️⃣ Authenticate with GitHub

```bash
gh auth login
```

**Follow prompts:**
- Choose: `GitHub.com`
- Choose: `HTTPS`
- Choose: `Login with a web browser`
- Copy the code, press Enter, paste in browser

---

## 3️⃣ Create Repository and Push Code

```bash
cd ~/Documents/RinaWarp-Terminal-Pro
gh repo create RinaWarp-Backend --public --source=. --remote=origin --push
```

**This single command will:**
- ✅ Create GitHub repository
- ✅ Add it as remote
- ✅ Push all your code
- ✅ Open repo in browser

---

## 4️⃣ Deploy to Render (Manual - Easiest)

1. Go to: https://dashboard.render.com
2. Click: **New +** → **Web Service**
3. Click: **Connect GitHub**
4. Select: **RinaWarp-Backend**
5. Configure:
   ```
   Name: rinawarp-backend
   Region: Oregon
   Branch: main
   Root Directory: backend
   Build Command: npm install
   Start Command: node server.js
   Instance Type: Free
   ```

6. Add Environment Variables (click "Advanced"):
   ```bash
   NODE_ENV=production
   PORT=10000
   CORS_ORIGINS=https://rinawarptech.com,https://www.rinawarptech.com
   STRIPE_SECRET_KEY=<from backend/.env>
   STRIPE_PUBLISHABLE_KEY=<from backend/.env>
   STRIPE_WEBHOOK_SECRET=<from backend/.env>
   STRIPE_SUCCESS_URL=https://rinawarptech.com/success
   STRIPE_CANCEL_URL=https://rinawarptech.com/pricing
   LICENSE_ISSUER=RinaWarp
   RATE_LIMIT_WINDOW_MS=60000
   RATE_LIMIT_MAX=120
   ```

7. Click: **Create Web Service**
8. Wait 2-3 minutes for deployment
9. Copy your live URL: `https://rinawarp-backend.onrender.com`

---

## 5️⃣ Update Frontend

```bash
# Edit downloads page
nano website/downloads.html

# Find and replace:
# OLD: const backendUrl = 'http://localhost:3001';
# NEW: const backendUrl = 'https://rinawarp-backend.onrender.com';

# Save and deploy
npm run deploy:website
```

---

## 6️⃣ Configure Stripe Webhooks

1. Go to: https://dashboard.stripe.com/webhooks
2. Click: **Add endpoint**
3. URL: `https://rinawarp-backend.onrender.com/api/stripe/webhook`
4. Select events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Click: **Add endpoint**
6. Copy webhook secret (starts with `whsec_`)
7. Update in Render: Environment → `STRIPE_WEBHOOK_SECRET` → Save

---

## 7️⃣ Test Deployment

```bash
# Test health endpoint
curl https://rinawarp-backend.onrender.com/health

# Expected: {"status":"healthy",...}
```

---

## ✅ Done!

Your backend is now live at:
```
https://rinawarp-backend.onrender.com
```

---

## 🔄 Future Updates

To deploy updates:

```bash
cd ~/Documents/RinaWarp-Terminal-Pro
git add .
git commit -m "Update backend"
git push origin main
```

Render will automatically redeploy! 🚀

---

## 📋 Stripe Keys Reference

Your keys are in: `backend/.env`

To view them:
```bash
cat backend/.env | grep STRIPE
```

---

## 🆘 Quick Troubleshooting

**Build fails?**
```bash
cd backend
npm install
node server.js
# Fix any errors, then push again
```

**Webhooks not working?**
- Check webhook secret matches Stripe dashboard
- Check Render logs for errors
- Verify webhook URL is correct

**CORS errors?**
- Update `CORS_ORIGINS` in Render environment variables
- Include all your domains (with https://)

---

**Need detailed help?** See `GITHUB-RENDER-DEPLOYMENT.md`
