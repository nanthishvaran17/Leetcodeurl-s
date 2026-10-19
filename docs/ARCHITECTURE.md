# Nandha LeetCode Intelligence System — Architecture & Developer Guide

Welcome to the **Nandha LeetCode Intelligence** platform. This guide provides a full architectural blueprint to help any new engineer understand, navigate, and contribute to this repository efficiently.

---

## 1. System High-Level Topology

```
                                  ┌──────────────────────────┐
                                  │   LeetCode GraphQL API   │
                                  └─────────────▲────────────┘
                                                │
                                    (Automated / Scheduled)
                                                │
┌───────────────────────────┐     ┌─────────────┴────────────┐     ┌──────────────────────────┐
│   Vite + React Frontend   │◄───►│  FastAPI Backend Server  │◄───►│ PostgreSQL / SQLite DB   │
│ (TypeScript, TailwindCSS) │     │ (Async Python 3.11+, WS) │     │ (SQLAlchemy ORM, Engine) │
└───────────────────────────┘     └─────────────┬────────────┘     └──────────────────────────┘
              ▲                                 │
              │                                 ▼
              │                   ┌──────────────────────────┐
              └───────────────────┤ Background Sync Workers  │
                   (WebSockets)   │ (Contest Scraper/Autopilot)
                                  └──────────────────────────┘
```

---

## 2. Directory Structure Map

```text
Leetcode Web/
├── releases/                    # Compiled native client artifacts
│   └── android/                 # Production Android APK binaries & releases
├── docs/                        # Architectural documentation & deployment blueprints
│   ├── ARCHITECTURE.md          # System architecture & developer onboarding guide
│   └── DEPLOYMENT.md            # Production deployment instructions
│
├── frontend/                    # Single-Page Web Application & Mobile Shell
│   ├── android/                 # Capacitor native Android container project
│   ├── electron/                # Electron desktop app wrapper configuration
│   ├── public/                  # Public static assets & downloadable APK copies
│   └── src/
│       ├── assets/              # Icons, badges, and static vector graphics
│       ├── components/          # Reusable component library
│       │   ├── admin/           # Administrative panels (staff, roles, audits)
│       │   ├── auth/            # Biometric, WebAuthn & passkey authentication
│       │   ├── common/          # Low-level UI primitives (buttons, modals, badges)
│       │   ├── layout/          # Global navigation, sidebar & shell layout
│       │   ├── leaderboard/     # Real-time contest tables & rank displays
│       │   └── ui/              # Design system tokens and styled widgets
│       ├── config/              # Frontend runtime configuration & API base URLs
│       ├── constants/           # Department codes, academic years & rank thresholds
│       ├── context/             # React Context Providers (centralized single source of truth)
│       │   ├── AuthContext.tsx           # Authentication state & role-based scopes
│       │   ├── DepartmentContext.tsx     # Department filter & institutional scope
│       │   ├── GlobalNotificationContext # In-app notification toast system
│       │   ├── GlobalWebSocketProvider   # Persistent WebSocket connection manager
│       │   └── ThemeContext.tsx          # Dark / Light theme token controller
│       ├── hooks/               # Custom React hooks (useAuth, useDepartments, useWebSocket)
│       ├── pages/               # Main routed views (Dashboard, Contests, Reports)
│       ├── services/            # HTTP API clients (Axios), WebSocket endpoints, FCM push
│       ├── types/               # TypeScript interfaces & domain entities
│       └── utils/               # Formatting, date parsing, and math helpers
│
├── backend/                     # High-Performance FastAPI Application Backend
│   ├── config/                  # App settings, environment resolution & secrets
│   ├── core/                    # Core runtime infrastructure
│   │   ├── cache.py             # In-memory Redis/Dict caching engine
│   │   ├── constants.py         # Institutional constants, contest rules
│   │   ├── logger.py            # Structured logging subsystem
│   │   └── security.py          # JWT, Passkey/WebAuthn, PBKDF2 cryptography
│   ├── database.py              # Database engine, connection pooling & SessionLocal
│   ├── models.py                # SQLAlchemy ORM models (Students, Contests, Staff, Logs)
│   ├── schemas.py               # Pydantic validation models for API payloads
│   ├── routes/                  # API Endpoint controllers (REST API v1)
│   │   ├── auth.py              # Login, Register, WebAuthn, OAuth, Password Reset
│   │   ├── leaderboard.py       # Global, Departmental, and Contest rankings
│   │   ├── students.py          # Student CRUD, LeetCode verification, profile stats
│   │   ├── weekly_contests.py   # Live contest scoring, forensic reconciliation
│   │   ├── reports.py           # On-demand & scheduled institutional exports
│   │   └── downloads.py         # Secure authenticated file & APK downloads
│   ├── services/                # Encapsulated business domain services
│   │   ├── sync_engine.py       # Distributed LeetCode profile synchronizer
│   │   ├── contest_truth_engine # Anti-cheat & participation verification
│   │   ├── email_service.py     # Transactional SMTP email delivery
│   │   └── websocket_manager.py # Broadcast manager for live push events
│   ├── exporters/               # Multi-format report generation engines
│   │   ├── excel_exporter.py    # Multi-tab styled institutional Excel sheets
│   │   ├── pdf_exporter.py      # Vector PDF generation with embedded analytics
│   │   └── word_exporter.py     # Formal Word document summaries
│   ├── scripts/                 # Utility, seeding & maintenance operations
│   │   └── maintenance/         # Historical DB schema patches, forensic verifications
│   ├── tests/                   # Automated pytest testing suite (unit & integration)
│   └── main.py                  # Application entry point, lifespan, middleware & routes
│
├── scripts/                     # Root devops & server management commands
│   ├── start_production.bat     # Windows production runner
│   ├── run_backend_prod.bat     # Backend service launcher
│   └── run_frontend_prod.bat    # Frontend server launcher
│
└── docker-compose.yml           # Multi-container orchestration specification
```

---

## 3. Key Architectural Principles

### 3.1 Frontend Clean Architecture
- **Single Source of Truth (`src/context/`):** All global state (Authentication, Department Scope, WebSocket streams, Theme) lives under `frontend/src/context/` and is exported cleanly through `frontend/src/context/index.ts`.
- **Decoupled API Layer (`src/services/`):** Pages never invoke `fetch()` directly; they call typed service methods (`api.ts`, `LiveEventRouter.ts`).
- **Responsive & Native-Ready:** The web app compiles to desktop (Electron) and native mobile (Capacitor Android) from the same codebase.

### 3.2 Backend Clean Architecture
- **Layered Separation of Concerns:**
  - `routes/`: Handles HTTP parameters, query validation, and HTTP responses.
  - `services/`: Houses all business calculations, scrapers, and external network calls.
  - `models.py` / `database.py`: Manages ORM persistence and transactional queries.
  - `exporters/`: Dedicated export engines for PDFs, Excel, and Word documents.
  - `scripts/maintenance/`: Keeps core runtime directory clean by isolating one-off data patches.

### 3.3 Database Resiliency & Failover
- **Dual Support (PostgreSQL / SQLite):** Automatically binds to Neon / PostgreSQL in production, with seamless fallback to SQLite for local development.
- **Connection Health Checks:** The `/ready` and `/health` endpoints continuously monitor pool connectivity and auto-reconnect if dropped.

---

## 4. Quick Start for New Developers

### Prerequisites
- Node.js 18+ (Node 20 recommended)
- Python 3.10+
- Git

### 1. Backend Setup
```bash
# From repository root:
python -m venv venv
venv\Scripts\activate       # Windows
# source venv/bin/activate  # macOS / Linux

pip install -r requirements.txt
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```
API Documentation will be live at: `http://localhost:8000/docs`

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Web client will be live at: `http://localhost:5173`

---

## 5. Coding Standards & Conventions
1. **Never commit APK or binary builds to the root directory.** Always route compiled binaries through `releases/android/`.
2. **Never leave loose test/fix scripts in `backend/` or `frontend/`.** Place automated tests in `backend/tests/` and one-off tools in `backend/scripts/maintenance/`.
3. **Always use typed interfaces in TypeScript.** Avoid `any` whenever domain types exist in `src/types/`.
4. **Preserve backward compatibility in API routes.**
