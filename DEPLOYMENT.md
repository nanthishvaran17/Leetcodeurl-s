# 🏛️ NANDHA ENGINEERING COLLEGE (AUTONOMOUS)
## Nandha LeetCode Intelligence — Production Cloud Deployment Guide

This project is configured for a modern, decoupled cloud architecture:
1. **Frontend**: **Vercel** (`frontend/vercel.json`) — Ultra-fast Global Edge CDN, React + TypeScript SPA.
2. **Backend**: **Cloud FastAPI Runtime** (`Dockerfile` / Cloud VM / Container) — Persistent Database, APScheduler, WebSocket, and LeetCode Sync Workers.

---

## ⚡ 1. Frontend Deployment on Vercel

Vercel hosts the React + TypeScript frontend with instant global edge caching and zero cold starts.

### Steps to Deploy on Vercel:
1. Push your repository to **GitHub**.
2. Log in to **[Vercel](https://vercel.com)** and click **"Add New Project"**.
3. Import the repository.
4. Set the **Root Directory** to `frontend` (or let Vercel use the root `vercel.json`).
5. Configure Environment Variables in Vercel Project Settings:
   - `VITE_API_URL`: Your live Cloud FastAPI Backend URL (e.g. `https://api.yourdomain.com`)
   - `VITE_FIREBASE_API_KEY`: Your Firebase API key
   - `VITE_FIREBASE_AUTH_DOMAIN`: `leetcode-student-data.firebaseapp.com`
   - `VITE_FIREBASE_PROJECT_ID`: `leetcode-student-data`
   - `VITE_FIREBASE_STORAGE_BUCKET`: `leetcode-student-data.firebasestorage.app`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`: `384483144435`
   - `VITE_FIREBASE_APP_ID`: `1:384483144435:web:bcc3284e79ed3ac5323d86`
6. Click **Deploy**. Your frontend is live with SSL at `https://your-app.vercel.app`!

---

## ⚡ 2. Backend Cloud Container Deployment (FastAPI)

The FastAPI backend runs continuous background tasks, Sunday automation schedulers (08:00–09:30 IST), WebSockets, and LeetCode sync workers.

### Cloud Container Requirements:
- **Runtime**: Docker / Python 3.10+
- **Persistent Disk / DB**: Cloud PostgreSQL (Supabase / Neon / RDS) or Persistent Volume SQLite
- **Exposed Port**: `${PORT:-8000}`
- **Health Check Endpoint**: `/health` (liveness) and `/ready` (readiness)

### Backend Environment Variables:
```env
ENVIRONMENT=production
PRODUCTION_DOMAIN=api.yourdomain.com
FRONTEND_ORIGIN=https://your-app.vercel.app
DATABASE_URL=sqlite:///./data/leetcode_tracker.db   # or postgresql://...
SECRET_KEY=your-production-secret-key
OTP_HMAC_SECRET=your-production-otp-secret
TIMEZONE=Asia/Kolkata
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
BREVO_API_KEY=your-brevo-api-key
```

### Steps to Run:
```bash
# Using Docker
docker build -t nandha-leetcode-api .
docker run -p 8000:8000 -v /path/to/persistent/data:/app/data nandha-leetcode-api

# Or directly with Uvicorn
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

---

## 🔒 3. Authentication & RBAC Scope

- **Super Admin**: Institutional Scope, Staff Allocation, Snapshots, System Operations.
- **HOD**: Department Scope, Analytics, Escalations.
- **Faculty / Staff**: Assigned Students Scope ONLY.
- **Student / Public**: Public-Safe Board & Personalized Progress.

### Default Admin Credentials (Initial Setup):
- **Username**: `admin`
- **Password**: `admin123` (Change immediately upon initial login)

---

## 📜 4. Historical Migration Note
*(Archival reference: The platform was previously hosted as a unified container on Render and has now been migrated to Vercel for the frontend + independent Cloud FastAPI container runtime for the backend.)*
