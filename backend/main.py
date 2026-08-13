import os
import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.config import settings
from backend.database import engine, Base
from backend.seed import seed_database
try:
    from backend.scheduler import start_scheduler
    SCHEDULER_AVAILABLE = True
except Exception as _sched_err:
    start_scheduler = None
    SCHEDULER_AVAILABLE = False
from backend.logger import logger

# Import routes
from backend.routes import (
    auth, students, departments, sessions,
    leaderboard, analytics, reports, settings as settings_route,
    audit, public, sync, history, risk, goals, system_health, weekly_contests
)
from backend.routes import admin, email_reports

app = FastAPI(
    title="College LeetCode Weekly Tracker API",
    description="Backend API for LeetCode weekly tracking, analytics, leaderboards, Excel/PDF reporting and notifications.",
    version="2.0.0"
)

# Health Endpoint for Render / Cloud Monitors
@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "College LeetCode Weekly Tracker API",
        "version": "2.0.0",
        "environment": os.environ.get("RENDER_SERVICE_ID", "local")
    }

# CORS Configuration
origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "https://leetcode-student-data.web.app",
    "https://leetcode-student-data.firebaseapp.com"
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://.*\.web\.app|https://.*\.firebaseapp\.com",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(students.router)
app.include_router(sync.router)
app.include_router(departments.router)
app.include_router(sessions.router)
app.include_router(leaderboard.router)
app.include_router(analytics.router)
app.include_router(reports.router)
app.include_router(settings_route.router)
app.include_router(audit.router)
app.include_router(public.router)
app.include_router(history.router)
app.include_router(risk.router)
app.include_router(goals.router)
app.include_router(system_health.router)
app.include_router(weekly_contests.router, prefix="/api")
app.include_router(email_reports.router)

# Mount Static File Directories
is_vercel = os.environ.get("VERCEL") == "1" or os.environ.get("VERCEL_ENV")
if is_vercel:
    REPORTS_DIR = "/tmp/reports"
else:
    REPORTS_DIR = os.path.join(os.path.dirname(__file__), "reports")

try:
    os.makedirs(REPORTS_DIR, exist_ok=True)
    app.mount("/static/reports", StaticFiles(directory=REPORTS_DIR), name="reports")
except Exception as e:
    logger.warning(f"Could not mount static reports directory: {e}")

from backend.migrate_db import run_db_migrations

@app.on_event("startup")
def on_startup():
    logger.info("Initializing database & tables...")
    try:
        run_db_migrations()
        from backend.database import run_migrations
        run_migrations()
    except Exception as _mig_err:
        logger.warning(f"Database migration note: {_mig_err}")

    try:
        seed_database()
        from backend.assets.reseed_all_stats import reseed_all_student_stats
        reseed_all_student_stats()
    except Exception as e:
        logger.warning(f"Database seed/reseed skipped or noted: {e}")

    try:
        from backend.database import SessionLocal
        from backend.models import SyncJob
        from backend.services.weekly_session_manager import resume_active_weekly_session
        db = SessionLocal()
        try:
            # Clean up any zombie sync locks from previous server restarts
            stale_jobs = db.query(SyncJob).filter(SyncJob.status == "RUNNING").all()
            if stale_jobs:
                for sj in stale_jobs:
                    sj.status = "INTERRUPTED"
                db.commit()
            asyncio.create_task(resume_active_weekly_session(db))
        except Exception as _rec_err:
            logger.warning(f"Session recovery note: {_rec_err}")
    except Exception as _db_err:
        logger.warning(f"Database session recovery skipped: {_db_err}")

    # Ensure all 273 students have a Firestore document with syncStatus:pending
    # so the frontend never shows "0 Solved / Verified just now" for unfetched students.
    try:
        from backend.assets.sync_firestore import initialize_pending_records
        initialize_pending_records()
    except Exception as _init_err:
        logger.warning(f"Firestore pending init note: {_init_err}")

    if not is_vercel and SCHEDULER_AVAILABLE:
        logger.info("Starting background scheduler...")
        try:
            start_scheduler()
            # NOTE: Intentionally NOT running run_batch_sync() on startup.
            # Starting a 273-student crawl on every Render restart would cause
            # duplicate concurrent syncs and unnecessary LeetCode API load.
            # Sync is triggered explicitly via POST /students/refresh-all.
        except Exception as e:
            logger.warning(f"Scheduler initialization note: {e}")
    elif not SCHEDULER_AVAILABLE:
        logger.warning("Scheduler skipped — pandas/numpy not available (Application Control policy).")
    logger.info("Backend Application ready and listening!")


from fastapi import WebSocket, WebSocketDisconnect
from backend.websocket_manager import manager

@app.websocket("/ws/leaderboard")
async def websocket_leaderboard_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.get("/api/health")
def health_check():
    return {
        "status": "HEALTHY",
        "app_name": settings.APP_NAME,
        "timezone": settings.TIMEZONE
    }

# Production Static Build Mount (Serves Frontend SPA bundle on single port)
FRONTEND_DIST = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.exists(FRONTEND_DIST):
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")

logger.info("LeetCode Performance Tracker API is fully ready & live sync engine active.")

