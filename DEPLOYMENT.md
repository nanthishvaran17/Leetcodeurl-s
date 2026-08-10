# 🏛️ NANDHA ENGINEERING COLLEGE (AUTONOMOUS)
## LeetCode Weekly Performance Tracker — Cloud Deployment Guide (Vercel / Netlify / Render)

This project is pre-configured with **Vercel (`vercel.json`)**, **Netlify (`netlify.toml`)**, and **Render (`render.yaml`)** for 100% free, high-speed, edge-cached deployment!

---

## ⚡ Option 1: Vercel Deployment (Recommended - Ultra-Fast & Free Edge CDN)

Vercel provides instant global edge deployment with zero cold starts.

### Steps to Deploy on Vercel:
1. Push your project code to **GitHub** or **GitLab**.
2. Go to **[Vercel.com](https://vercel.com)** and click **"Add New Project"**.
3. Import your GitHub Repository `Leetcodeurl-s`.
4. Vercel will automatically detect `vercel.json` and deploy both:
   - **Frontend**: Global Edge CDN (`frontend/dist`)
   - **Backend API**: Python Serverless Functions (`api/index.py`)
5. Click **Deploy**! Your site will be live instantly at `https://your-app.vercel.app`!

---

## ⚡ Option 2: Render.com Cloud Hosting (Full Docker Container)

Render hosts the full Docker container with background schedulers running continuously for Sunday snapshot triggers.

### Steps to Deploy on Render:
1. Log in to **[Render.com](https://render.com)**.
2. Click **New +** -> **Web Service**.
3. Connect your GitHub repository.
4. Select **Docker** environment (Render automatically reads `Dockerfile` & `render.yaml`).
5. Click **Deploy Web Service**!
6. Your live site will be live at `https://nandha-leetcode-platform.onrender.com`!

---

## ⚡ Option 3: Netlify Deployment

1. Log in to **[Netlify.com](https://netlify.com)**.
2. Import your GitHub repository.
3. Build command: `cd frontend && npm install && npm run build`
4. Publish directory: `frontend/dist`
5. Netlify will deploy the site with instant CDN caching using `netlify.toml`!

---

## 🔑 Admin Credentials
- **Username**: `admin`
- **Password**: `admin123`
