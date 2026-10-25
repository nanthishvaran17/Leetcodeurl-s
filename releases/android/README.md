# Mobile App Release Packages

This directory contains the production-ready compiled Android APK builds for the **Nandha LeetCode Intelligence** mobile application.

## Active Releases
- **Latest Version:** `Nandha_LeetCode_Intelligence_v3.2.1_latest.apk` (VersionCode 61)
- **Aliases:** `Nandha-LeetCode-Tracker-Latest.apk`, `nandha-leetcode.apk`

## How To Build
From the `frontend/` directory:
```bash
npm run build:apk
```
This automatically compiles the web assets, syncs Capacitor Android, builds the signed release APK, and places the output here and in `frontend/public/` for instant download.
