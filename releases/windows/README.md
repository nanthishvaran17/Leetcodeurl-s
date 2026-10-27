# Windows Desktop Release Packages

This directory contains the production-ready compiled Windows Desktop (.EXE) installers for the **Nandha LeetCode Intelligence** desktop application.

## Active Releases
- **Latest Version:** `Nandha_LeetCode_Intelligence_v3.2.7_Setup.exe`
- **Aliases:** `Nandha_LeetCode_Intelligence_Latest_Setup.exe`, `nandha-leetcode-setup.exe`

## How To Build
From the `frontend/` directory:
```bash
npm run build:exe
```
This automatically compiles the web bundle with Vite, packages the Electron runtime with NSIS, digitally signs the binaries, and places the output here and in `frontend/public/` for direct download.
