# RinaWarp Backend API Server

Production-ready Node.js Express server with comprehensive features for AI integration, payments, licensing, and CLI tools.

## 🚀 Quick Start

### Installation

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit environment variables
nano .env
```

### Development

```bash
# Start development server with hot reload
npm run dev

# Or use nodemon
npm run dev
```

### Production

```bash
# Start production server
npm run prod

# Or with PM2
pm2 start pm2.config.cjs

# Check status
pm2 status

# View logs
pm2 logs rinawarp-backend
```

## 🛠 Features

### Core Features

- **Security**: Helmet, CORS, Rate Limiting
- **Health Monitoring**: `/api/health` endpoint
- **Error Handling**: Graceful shutdown and error recovery
- **Logging**: Comprehensive logging with mood-based RINA personality

### API Routes

- `/api/ai` - AI provider integration (OpenAI, Groq)
- `/api/stripe` - Payment processing
- `/api/license` - License management
- `/api/cli` - CLI tool integration
- `/api/admin/music-video` - Admin functions

### Advanced Features

- WebSocket support for real-time communication
- File upload handling
- JWT authentication
- Sentry error monitoring
- PostHog analytics integration

## 🔧 Environment Configuration

### Required Variables

```bash
# Server
NODE_ENV=production
PORT=3001

# AI Services
OPENAI_API_KEY=your_openai_key
GROQ_API_KEY=your_groq_key
ELEVENLABS_API_KEY=your_elevenlabs_key

# Payments
STRIPE_SECRET_KEY=sk_live_your_key
STRIPE_WEBHOOK_SECRET=whsec_your_secret

# Email
SMTP_USER=your_email
SMTP_PASS=your_app_password
```

### Optional Variables

```bash
# Analytics
POSTHOG_API_KEY=phc_your_key

# AWS S3
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=120
```

## 🐳 Docker Deployment

```bash
# Build image
docker build -t rinawarp-backend .

# Run container
docker run -d \
  --name rinawarp-backend \
  -p 3001:3001 \
  --env-file .env \
  rinawarp-backend
```

## 🔄 PM2 Management

```bash
# Start all processes
pm2 start pm2.config.cjs

# Restart specific process
pm2 restart rinawarp-backend

# Stop specific process
pm2 stop rinawarp-backend

# View logs
pm2 logs rinawarp-backend

# Monitor
pm2 monit
```

## 🏗 Production Architecture

### Load Balancing

- Use nginx as reverse proxy
- Configure SSL certificates
- Implement health checks

### Monitoring

- Health endpoint: `/api/health`
- Log files in `logs/` directory
- Sentry integration for error tracking

### Security

- Rate limiting enabled
- CORS properly configured
- Helmet security headers
- Input validation and sanitization

## 📊 API Documentation

### Health Check

```http
GET /api/health
```

Response:

```json
{
  "ok": true,
  "status": "healthy",
  "timestamp": "2025-11-11T03:43:08.803Z",
  "uptime": 3600,
  "version": "1.0.0",
  "environment": "production"
}
```

### AI Routes

- `POST /api/ai/chat` - Chat completion
- `POST /api/ai/stream` - Streaming response

### Payment Routes

- `POST /api/stripe/create-payment-intent`
- `POST /api/stripe/webhook` - Webhook handler

## 🔍 Troubleshooting

### Common Issues

1. **Port already in use**

   ```bash
   # Kill process using port 3001
   npm run kill-backend
   ```

2. **Missing dependencies**

   ```bash
   # Reinstall all dependencies
   rm -rf node_modules package-lock.json
   npm install
   ```

3. **Environment variables**

   ```bash
   # Check loaded environment
   npm run dev | grep "Loaded environment"
   ```

### Debug Mode

```bash
# Enable debug logging
DEBUG=* npm run dev
```

## 📈 Performance

### Optimization

- Gzip compression
- Request rate limiting
- Connection pooling
- Memory management

### Scaling

- Horizontal scaling with load balancer
- Redis for session storage
- Database connection pooling
- CDN for static assets

## 🛡 Security

### Implemented

- Security headers via Helmet
- CORS protection
- Rate limiting
- Input validation
- SQL injection protection

### Recommendations

- Use HTTPS in production
- Regular security updates
- Monitor for suspicious activity
- Implement proper logging
- Use environment-specific configurations

## 🤝 Contributing

1. Follow the existing code structure
2. Add tests for new features
3. Update documentation
4. Use the RINA logger for consistency
5. Follow the deployment checklist

## 📄 License

MIT License - see LICENSE file for details.
