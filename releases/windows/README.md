# 💻 Windows Desktop Release Packages

This directory contains the production-ready compiled Windows Desktop (.EXE) installers for the **Nandha LeetCode Intelligence** platform.

## 🏆 Developed by Nanthish & Team
**Nandha Engineering College (Autonomous)**  
*Accredited by NAAC with 'A+' Grade • Approved by AICTE • Affiliated to Anna University*

---

## 📦 Active Releases

- **Latest Stable Version:** [`Nandha_LeetCode_Intelligence_v4.1.1_Setup.exe`](./Nandha_LeetCode_Intelligence_v4.1.1_Setup.exe) (151 MB)
- **Universal Aliases:**
  - `Nandha_LeetCode_Intelligence_Latest_Setup.exe`
  - `nandha-leetcode-setup.exe`

## 🚀 Key Features in v4.1.1 Desktop
- **Electron 30 + Chromium Architecture:** Ultra-smooth 60-120fps hardware-accelerated dashboard rendering.
- **Offline Session Vault & SQLite WAL Streaming:** Resilient state synchronization across local sessions.
- **Institutional Multi-Tenant Dashboard:** One-click instant switching between HOD Command Center, Faculty Action Center, Placement Finder, and Student Live Trackers.
- **Embedded Auto-Updater & Tray Control:** Desktop notifications for Sunday Contest Autopilot phases (08:00 AM - 10:30 AM IST).

## 🛠️ How To Build
From the `frontend/` directory:
```bash
npm run build:exe
```
This automatically compiles the web bundle with Vite, packages the Electron runtime with NSIS, digitally validates the uninstaller binaries, and mirrors the release outputs to both `releases/windows/` and `frontend/public/` for instant web downloads.
