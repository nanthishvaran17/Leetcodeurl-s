# 🌟 Contributing to Nandha LeetCode Intelligence (NLCI)

<div align="center">

<img src="https://raw.githubusercontent.com/nanthishvaran17/Leetcodeurl-s/main/docs/assets/nec_25_years_logo.png" alt="Nandha Engineering College 25 Years" width="120" style="border-radius: 50%; box-shadow: 0 8px 24px rgba(0,0,0,0.15); margin-bottom: 12px;" />

### Autonomous Institutional Contest Intelligence • Level 4 Forensic Verification • Student Mentorship Platform
**Nandha Engineering College (Autonomous), Erode, Tamil Nadu, India**  
*Accredited by NAAC with 'A+' Grade • Approved by AICTE • Autonomous Institution Affiliated to Anna University*

[![Version](https://img.shields.io/badge/Production-v4.6.3-blue.svg?style=flat-square)](https://github.com/nanthishvaran17/Leetcodeurl-s/releases/latest)
[![Android APK](https://img.shields.io/badge/Android%20APK-v4.6.3%20(VC%20103)-3DDC84.svg?style=flat-square)](https://github.com/nanthishvaran17/Leetcodeurl-s/tree/main/releases/android)
[![Windows EXE](https://img.shields.io/badge/Windows%20EXE-v4.5.2-0078D6.svg?style=flat-square)](https://github.com/nanthishvaran17/Leetcodeurl-s/tree/main/releases/windows)
[![Code Style: Black](https://img.shields.io/badge/Code%20Style-Black-000000.svg?style=flat-square)](https://github.com/psf/black)
[![TypeScript: Strict](https://img.shields.io/badge/TypeScript-Strict%20Mode-3178C6.svg?style=flat-square)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](https://github.com/nanthishvaran17/Leetcodeurl-s/blob/main/LICENSE)

</div>

Thank you for your interest in contributing to **Nandha LeetCode Intelligence (NLCI)**! This platform is the official institutional intelligence, contest verification, and student mentorship engine powering **1,500+ engineering students** across all engineering departments.

Whether you are fixing a bug, adding telemetry features, optimizing mobile performance, or polishing institutional analytics, your contributions uphold academic excellence and software integrity.

---

## 📑 Table of Contents
1. [Code of Conduct & Institutional Integrity](#-code-of-conduct--institutional-integrity)
2. [Platform Architecture & Multi-Target Matrix](#-platform-architecture--multi-target-matrix)
3. [Local Development Setup](#-local-development-setup)
4. [Branching & Git Commit Conventions](#-branching--git-commit-conventions)
5. [Engineering & Coding Standards](#-engineering--coding-standards)
6. [Testing & Verification Suite](#-testing--verification-suite)
7. [Submitting a Pull Request (PR)](#-submitting-a-pull-request-pr)
8. [Reporting Security Issues](#-reporting-security-issues)
9. [Institutional Recognition & Attribution](#-institutional-recognition--attribution)

---

## 🏛️ Code of Conduct & Institutional Integrity

Because NLCI manages institutional academic records, NBA/NAAC accreditation metrics, placement eligibility rosters, and real-time contest verifications, every contributor must strictly observe:

* **Zero Bypass Policy:** Never bypass authentication checks, role-based access controls (RBAC), database immutability triggers, or cryptographic token validators.
* **Privacy by Design:** Never log, expose, or extract student Personally Identifiable Information (PII), passwords, or private contest submissions.
* **Academic Honor Code:** Do not tamper with contest scoring algorithms, streak calculators, or attendance telemetry.
* **Respectful Collaboration:** Maintain professional, welcoming, and constructive communication across issues, pull requests, and code reviews.

---

## 🏗️ Platform Architecture & Multi-Target Matrix

The platform is designed as an ultra-fast, multi-tenant, defense-in-depth system:

```text
Leetcodeurl-s/
├── backend/                       # FastAPI 0.115+ High-Performance Python Engine
│   ├── alembic/                   # Database migrations & schema evolution
│   ├── models.py                  # SQLAlchemy models & constraint mappings
│   ├── routes/                    # REST endpoints (students, admin, reports, sync, auth)
│   ├── services/                  # Business logic (LeetCode GraphQL, forensic verification, cache)
│   ├── sunday_runner.py           # Autonomous Sunday Contest Pipeline runner
│   └── tests/                     # Automated pytest test suites
├── frontend/                      # React 18 + Vite 5 + Tailwind CSS SPA
│   ├── src/
│   │   ├── components/            # Reusable UI widgets & atomic controls
│   │   ├── pages/                 # Route-level views (lazy-loaded chunk modules)
│   │   ├── context/               # Global state providers (Auth, Notifications, SWR)
│   │   └── services/              # API clients, offline cache & Web Workers
│   ├── android/                   # Capacitor 7 Native Android Application project
│   └── electron/                  # Electron 34 Desktop Application runtime
├── releases/
│   ├── android/                   # Production signed release APKs (v4.5.5)
│   └── windows/                   # Production Windows Desktop installers (v4.5.2)
└── .github/workflows/             # Autonomous CI/CD and Sunday contest pipelines
```

---

## 💻 Local Development Setup

### 1. Prerequisites
* **Python:** 3.10, 3.11, or 3.12
* **Node.js:** v20.x or v22.x LTS (with `npm` v10+)
* **Git:** v2.40+
* **Java SDK:** OpenJDK 17 or 21 (Required only for Android APK builds)
* **Android Studio & SDK:** API Level 34+ (Required only for mobile native builds)

### 2. Clone the Repository
```bash
git clone https://github.com/nanthishvaran17/Leetcodeurl-s.git
cd Leetcodeurl-s
```

### 3. Backend Setup
```bash
# Create and activate Python virtual environment
python -m venv venv

# Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# Linux / macOS:
source venv/bin/activate

# Upgrade pip & install dependencies
python -m pip install --upgrade pip
pip install -r requirements.txt

# Run backend development server
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```
API Documentation will be live at: `http://localhost:8000/docs`

### 4. Frontend Setup
```bash
cd frontend

# Install dependencies cleanly
npm install

# Start Vite HMR development server
npm run dev
```
Client Application will be live at: `http://localhost:5173`

### 5. Android Native Setup (Optional)
```bash
cd frontend

# Compile web assets and sync to native Android platform
npm run cap:sync

# Open in Android Studio
npm run cap:open:android
```

---

## 🌿 Branching & Git Commit Conventions

### Branch Naming Scheme
* Feature branches: `feat/feature-name` (e.g. `feat/mentor-export-filter`)
* Bug fixes: `fix/bug-description` (e.g. `fix/dropdown-zindex-overlay`)
* Performance: `perf/optimization-target` (e.g. `perf/contest-swr-cache`)
* Documentation: `docs/documentation-update` (e.g. `docs/update-release-matrix`)

### Conventional Commits Format
We enforce the [Conventional Commits](https://www.conventionalcommits.org/) specification:
```text
<type>(<scope>): <short imperative description>

[optional body providing detailed technical reasoning]

[optional footer referencing issue numbers or breaking changes]
```

#### Valid Types:
* `feat`: A new feature or institutional capability
* `fix`: A bug fix or patch
* `docs`: Documentation updates only
* `style`: Formatting, padding, indentation (no production logic change)
* `refactor`: Code change that neither fixes a bug nor adds a feature
* `perf`: Code change that improves performance, latency, or memory consumption
* `test`: Adding or correcting automated tests
* `build`: Changes affecting build systems, dependencies, or release packaging
* `ci`: Changes to GitHub Actions pipelines or automation scripts

---

## 📐 Engineering & Coding Standards

### Python & Backend Standards
* **PEP 8 & Formatting:** Code must conform to PEP 8 standards with strict type annotations (`typing`).
* **Database Sessions:** Always use context-managed sessions (`db: Session = Depends(get_db)`); never leave connections uncommitted or unclosed.
* **SQL Injection Prevention:** Use SQLAlchemy ORM or parameterized queries with bound variables. Raw f-strings inside `text()` queries are strictly forbidden.
* **Asynchronous Execution:** Heavy network queries (e.g., LeetCode GraphQL fetchers, mass email dispatches) must execute asynchronously or inside `BackgroundTasks`.

### Frontend & React Standards
* **TypeScript Strict Mode:** All `.tsx` and `.ts` files must compile with 0 errors under `npx tsc --noEmit`. No loose `any` types where interfaces can be defined.
* **Lazy Loading:** All full-page route views and heavy modals must be dynamically imported via `React.lazy()` with `Suspense` fallbacks to preserve sub-10ms route transitions.
* **Tailwind CSS Consistency:**
  * Support both Light and Dark modes (`dark:bg-navy-900`, `dark:text-white`).
  * Ensure touch targets are at least `44px` on mobile (`min-h-[44px]`).
  * Use proper z-index layering (`z-[99999999]` for top-layer interactive drawers/dialogs).
* **Responsive Layouts:** Test layouts across Mobile (360px), Tablet (768px), Desktop (1024px+), and 4K Smart TV Kiosk views.

### Mobile & Android Standards
* **Hardware Acceleration:** Ensure hardware rendering is enabled in native views (`android.view.View.LAYER_TYPE_HARDWARE`).
* **Background Push:** Use high-priority notification channels (`leetcode_intelligence_channel`) for critical contest and academic alerts.
* **Battery Conservation:** Never run indefinite polling loops in foreground threads; rely on WebSocket telemetry or push signals.

---

## 🧪 Testing & Verification Suite

Before submitting any code for review, you **must run the full pre-flight verification suite**:

```bash
# 1. Run Python unit & integration tests
python -m pytest backend/tests/ -v

# 2. Run TypeScript strict compiler verification
npm --prefix frontend run tsc

# 3. Run Vite production bundle build & asset compression
npm --prefix frontend run build

# 4. Verify Android platform synchronization (if mobile code was modified)
npm --prefix frontend run cap:sync

# 5. Build signed Android Release APK (optional, verify build passes)
npm --prefix frontend run build:apk
```

---

## 🚀 Submitting a Pull Request (PR)

1. **Keep PRs Focused:** Submit small, targeted pull requests addressing one logical feature or fix.
2. **Sync with Main:** Rebase your branch against the latest upstream `main` branch before submitting:
   ```bash
   git fetch origin
   git rebase origin/main
   ```
3. **PR Description:** Include:
   * **Problem Summary:** What issue or limitation is being addressed?
   * **Technical Solution:** How does your implementation resolve it?
   * **Screenshots / Logs:** Attach visual proof (mobile/desktop screenshots) and test logs.
   * **Platform Impact:** Note whether Web, Android APK, or Windows Desktop are affected.
4. **Code Review:** At least one core maintainer review and clean GitHub Actions CI checks are required prior to merging.

---

## 🛡️ Reporting Security Issues

Please **do not disclose security vulnerabilities publicly**. Follow our responsible disclosure guidelines detailed in [`SECURITY.md`](https://github.com/nanthishvaran17/Leetcodeurl-s/blob/main/SECURITY.md):
* **Private Advisory:** Submit via [GitHub Security Advisories](https://github.com/nanthishvaran17/Leetcodeurl-s/security/advisories/new).
* **Direct Email:** Encrypted report to Institutional Maintainer: `nanthishvaran17@gmail.com`.
* Review the [Security Policy](https://github.com/nanthishvaran17/Leetcodeurl-s/blob/main/SECURITY.md) for our guaranteed response SLAs and Security Hall of Fame criteria.

---

## 🏆 Institutional Recognition & Attribution

Every meaningful contribution is recognized! Contributors are acknowledged in:
* The repository's official release notes.
* The Nandha Engineering College Institutional Developer Hall of Fame.
* Formal academic commendation letters for student contributors upon request.

---

<div align="center">

**Lead Platform Architect & Maintainer:**  
**Nanthish S** ([@nanthishvaran17](https://github.com/nanthishvaran17))  
Department of Computer Science & Engineering  
**Nandha Engineering College (Autonomous), Erode, Tamil Nadu, India**

*Crafted with pride for autonomous engineering excellence.*

</div>
