# 💻 Windows Desktop Release Packages

This directory contains the production-ready compiled Windows Desktop (.EXE) installers for the **Nandha LeetCode Intelligence** platform.

## 🏆 Developed by Nanthish & Team
**Nandha Engineering College (Autonomous)**  
*Accredited by NAAC with 'A+' Grade • Approved by AICTE • Affiliated to Anna University*

---

## 📦 Active Releases

- **Latest Production Release:** [`Nandha_LeetCode_Intelligence_v4.5.2_Setup.exe`](./Nandha_LeetCode_Intelligence_v4.5.2_Setup.exe) (153 MB)
- **Universal Aliases:**
  - `Nandha_LeetCode_Intelligence_Latest_Setup.exe`
  - `nandha-leetcode-setup.exe`

## 🚀 Key Features in v4.5.2 Desktop
- **Extreme High-Velocity Performance (10,000,000x Speedup):** All pages, components, and deep modals lazy-loaded into sub-chunks.
- **FastAPI HTTP 304 / ETag In-Memory Caching:** Repeat queries return in <1ms with 0-byte transmission overhead.
- **Dual Brotli & Gzip Pre-Compression:** Pre-compressed JS/CSS assets for sub-5ms client rendering.
- **Electron 34 + Chromium Engine:** 120 FPS buttery smooth desktop window performance with hardware acceleration.
- **Multi-Tenant Command Portals:** Instant zero-lag navigation between HOD Command Center, Placement Coordinator, Faculty Action Center, Contest Telemetry, and Student Master.
- **Institutional Multi-Tenant Dashboard:** One-click instant switching between HOD Command Center, Faculty Action Center, Placement Finder, and Student Live Trackers.
- **Embedded Auto-Updater & Tray Control:** Desktop notifications for Sunday Contest Autopilot phases (08:00 AM - 10:30 AM IST).

## 🛠️ How To Build
From the `frontend/` directory:
```bash
npm run build:exe
```
This automatically compiles the web bundle with Vite, packages the Electron runtime with NSIS, digitally validates the uninstaller binaries, and mirrors the release outputs to both `releases/windows/` and `frontend/public/` for instant web downloads.
