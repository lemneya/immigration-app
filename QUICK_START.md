# 🚀 Immigration Suite - Quick Start Guide

## 📍 When You Come Back Tomorrow

### Super Quick Start (One Command!)
```bash
cd ~/immigration-suite
./start.sh
```
Then choose option 1 for Docker or option 2 for development mode.

---

## 📱 Main Access Points

### For Immigrants (Your Users)
- **Client Portal**: http://localhost:3013
  - Trustworthy Dashboard with 8 Quick Actions
  - Emotional UI Components (Journey, Family, SOS, Story)
  - Multi-language (EN, ES, AR, FR)

### For Your Team
- **Admin Dashboard**: http://localhost:3012
- **Paralegal Dashboard**: http://localhost:3021
- **Attorney Review**: http://localhost:3022

---

## 🛠️ Development Commands

### Option 1: Docker (Recommended for Quick Start)
```bash
# Start everything
docker-compose up -d

# Check status
docker-compose ps

# Stop everything
docker-compose down
```

### Option 2: Development Mode (For Active Coding)
```bash
# Start core services
cd ~/immigration-suite
pnpm dev:all

# Or start individual services
cd apps/client-portal && pnpm dev
cd apps/security && pnpm dev
cd apps/mail-service && pnpm dev
```

### Option 3: Minimal Mode (Just the Essentials)
```bash
# Start only Client Portal + Security
cd apps/security && pnpm dev &
cd apps/client-portal && pnpm dev
```

---

## 📊 Service Status Check

### Check What's Running
```bash
# Docker services
docker ps

# Node processes
ps aux | grep pnpm

# Ports in use
lsof -i :3013  # Client Portal
lsof -i :3007  # Security Service
```

---

## 🔑 Key Services & Ports

| Service | Port | Purpose |
|---------|------|---------|
| Client Portal | 3013 | Main immigrant interface |
| Security | 3007 | Authentication & authorization |
| Admin Dashboard | 3012 | Admin interface |
| Paralegal Dashboard | 3021 | Case management |
| Mail Service | 3010 | Document processing |
| OCR Service | 3001 | Text extraction |
| PDF Fill | 3002 | Form filling |
| E-Signature | 3003 | Document signing |
| Voice Translation | 3006 | Live translation |
| PostgreSQL | 5433 | Main database |
| Redis | 6379 | Cache & queues |
| MongoDB | 27017 | Document store |

---

## 📝 What We've Built

### ✅ Completed Features
- **19+ Microservices** fully operational
- **Emotional UI Components**:
  - JourneyCompanion (timeline)
  - FamilyTree (multi-case tracking)
  - EmergencySOS (panic button)
  - MyStory (digital memory book)
- **Trustworthy Dashboard** with 8 Quick Actions
- **Multi-language Support** (EN, ES, AR, FR)
- **Parlant AI Integration** ready

### 🚧 Next Steps (When You Return)
1. Complete PaddleOCR service for better Arabic OCR
2. Add Presidio for PII masking
3. Implement Marian Translator
4. Set up Unleash feature flags
5. Configure Grafana monitoring

---

## 🆘 Troubleshooting

### If Services Won't Start
```bash
# Clear everything and restart
docker-compose down -v
docker-compose up -d

# Or in dev mode
pkill -f "pnpm dev"
cd ~/immigration-suite
./start.sh
```

### If Ports Are Busy
```bash
# Find what's using a port (e.g., 3013)
lsof -i :3013
# Kill the process
kill -9 [PID]
```

---

## 📱 Test the App

1. **Client Portal**: http://localhost:3013
   - Click any Quick Action tile
   - Try the Emergency SOS button
   - View Journey Timeline
   - Check Family Tree

2. **Admin Dashboard**: http://localhost:3012
   - Login with admin credentials
   - View system metrics

---

## 💾 GitHub Repository

All code is saved at: https://github.com/lemneya/immigration-app.git

To pull latest changes:
```bash
cd ~/immigration-suite
git pull origin main
```

---

## 🎯 Remember

Your immigration suite is ready to help immigrants with:
- **Trust**: One task at a time philosophy
- **Love**: Emotional support features
- **Efficiency**: 19+ integrated services
- **Safety**: Emergency SOS & rights info
- **Family**: Track multiple cases together

---

## 📞 Quick Commands Summary

```bash
# Start everything
cd ~/immigration-suite && ./start.sh

# Check logs
docker-compose logs -f [service-name]

# Restart a service
docker-compose restart [service-name]

# Stop everything
docker-compose down
```

---

**You're all set! The app is ready to continue whenever you return.** 🚀