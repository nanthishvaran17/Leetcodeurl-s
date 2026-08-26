import os
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, Response, Depends, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.config import settings
from backend.database import engine, Base, get_db
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
    audit, public, sync, history, risk, goals, system_health, weekly_contests,
    scheduled_reports, certificates, data_issues, faculty_assignments, institutional_dashboards,
    email_campaigns, bot_notifications, anti_cheat, placement_eligibility, gamification, accreditation,
    whatsapp_webhook, deep_tech_intelligence
)
from backend.routes import admin, email_reports, ai_assistant, leetcode, ai_control_center, intelligence
from backend.routes import command_center
from backend import leetcode_tracker
from backend.services.heartbeat_service import get_deep_health_telemetry
from backend.websocket_manager import manager


# =====================================================================
# 1. NON-BLOCKING ASYNCHRONOUS INITIALIZATION & LIFESPAN
# =====================================================================

async def _deferred_startup_tasks():
    """Executes background DB migrations, admin reconcile, and scheduler asynchronously after port binding."""
    logger.info("[STARTUP] Running background post-bind initialization...")
    try:
        from backend.migrate_db import run_db_migrations
        run_db_migrations()
        from backend.database import run_migrations
        run_migrations()
    except Exception as _mig_err:
        logger.warning(f"[STARTUP] Database migration note: {_mig_err}")

    try:
        from backend.database import SessionLocal
        from backend.models import Student, User, LeetCodeProfileStats, SyncJob
        from backend.routes.auth import get_password_hash, verify_password

        with SessionLocal() as db_init:
            try:
                admin_username = getattr(settings, "ADMIN_USERNAME", "admin").strip()
                admin_email = getattr(settings, "ADMIN_EMAIL", "nanthishvaran17@gmail.com").strip().lower()
                admin_pass = getattr(settings, "ADMIN_PASSWORD", "admin123").strip() or "admin123"

                admin_user = db_init.query(User).filter(
                    (User.username.ilike(admin_username)) | (User.email.ilike(admin_email))
                ).first()

                if not admin_user:
                    admin_user = User(
                        username=admin_username,
                        email=admin_email,
                        hashed_password=get_password_hash(admin_pass),
                        role="Admin",
                        is_active=True
                    )
                    db_init.add(admin_user)
                    db_init.commit()
                    logger.info(f"[STARTUP] Reconciled initial admin user: {admin_username}")
                else:
                    admin_user.role = "Admin"
                    admin_user.is_active = True
                    if not verify_password(admin_pass, str(admin_user.hashed_password)):
                        admin_user.hashed_password = get_password_hash(admin_pass)
                        db_init.commit()
            except Exception as _adm_err:
                logger.warning(f"[STARTUP] Admin reconcile note: {_adm_err}")

            try:
                # Clean up any zombie sync locks from previous server restarts
                stale_jobs = db_init.query(SyncJob).filter(SyncJob.status == "RUNNING").all()
                if stale_jobs:
                    for sj in stale_jobs:
                        sj.status = "INTERRUPTED"
                    db_init.commit()
            except Exception as _sj_err:
                logger.warning(f"[STARTUP] Sync job recovery note: {_sj_err}")

            try:
                from backend.services.weekly_session_manager import resume_active_weekly_session
                await resume_active_weekly_session(db_init)
            except Exception as _sess_err:
                logger.warning(f"[STARTUP] Weekly session resume note: {_sess_err}")

    except Exception as e:
        logger.warning(f"[STARTUP] Deferred DB init note: {e}")

    try:
        from backend.assets.sync_firestore import initialize_pending_records
        await asyncio.to_thread(initialize_pending_records)
    except Exception as _init_err:
        logger.warning(f"[STARTUP] Firestore pending init note: {_init_err}")

    is_vercel = os.environ.get("VERCEL") == "1" or os.environ.get("VERCEL_ENV")
    if not is_vercel and SCHEDULER_AVAILABLE:
        try:
            logger.info("[STARTUP] Starting background scheduler...")
            start_scheduler()
            from backend.services.schedule_service import get_or_create_default_schedule, register_apscheduler_job
            with SessionLocal() as _sched_db:
                _cfg = get_or_create_default_schedule(_sched_db)
                register_apscheduler_job(_cfg)
        except Exception as e:
            logger.warning(f"[STARTUP] Scheduler initialization note: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI modern lifespan handler replacing deprecated on_event handlers."""
    logger.info("[STARTUP] FastAPI process alive. Port binding established immediately.")
    asyncio.create_task(_deferred_startup_tasks())
    yield
    logger.info("[SHUTDOWN] FastAPI process receiving termination signal. Releasing resources gracefully...")
    try:
        engine.dispose()
    except Exception as _dis_err:
        logger.warning(f"[SHUTDOWN] Engine disposal note: {_dis_err}")
    logger.info("[SHUTDOWN] Graceful shutdown complete.")


app = FastAPI(
    title="College LeetCode Weekly Tracker API",
    description="Backend API for LeetCode weekly tracking, analytics, leaderboards, Excel/PDF reporting and notifications.",
    version="2.0.0",
    lifespan=lifespan
)


# =====================================================================
# 2. LIGHTWEIGHT PRODUCTION HEALTH & READINESS PROBES
# =====================================================================

@app.api_route("/health", methods=["GET", "HEAD"])
@app.api_route("/api/health", methods=["GET", "HEAD"])
@app.api_route("/", methods=["GET", "HEAD"])
@app.api_route("/api", methods=["GET", "HEAD"])
def health_check():
    """
    Ultra-lightweight Liveness Probe for Render & UptimeRobot (< 1ms).
    NEVER queries DB, external APIs, Firebase, or filesystem.
    Immediately returns HTTP 200 whenever the process is alive.
    """
    return {
        "status": "healthy",
        "service": "College LeetCode Weekly Tracker API",
        "version": "2.0.0"
    }

@app.api_route("/ready", methods=["GET", "HEAD"])
@app.api_route("/api/ready", methods=["GET", "HEAD"])
def readiness_check(response: Response):
    """
    Production Readiness Probe verifying critical runtime dependencies.
    Returns 200 when database is responsive, 503 if temporarily unavailable.
    """
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {
            "status": "ready",
            "database": "connected",
            "service": "College LeetCode Weekly Tracker API",
            "version": "2.0.0"
        }
    except Exception as exc:
        response.status_code = 503
        return {
            "status": "not_ready",
            "database": "unreachable",
            "error": str(exc),
            "version": "2.0.0"
        }

@app.api_route("/health/deep", methods=["GET"])
@app.api_route("/api/health/deep", methods=["GET"])
def deep_health_check(db: Session = Depends(get_db)):
    """
    Deep Diagnostic Health Probe verifying database, worker, scheduler, and telemetry.
    """
    return get_deep_health_telemetry(db)

@app.api_route("/health/performance", methods=["GET"])
@app.api_route("/api/health/performance", methods=["GET"])
def performance_metrics_check():
    """
    Operational Performance Telemetry: p50, p95, p99 latencies, RAM RSS, CPU, and Cache efficiency.
    """
    from backend.middleware.performance_profiler import get_performance_metrics
    return get_performance_metrics()


# Performance Middleware
from backend.middleware.performance_profiler import PerformanceMonitoringMiddleware
app.add_middleware(PerformanceMonitoringMiddleware)

# CORS Configuration
origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "https://leetcode-frontend-deploy.vercel.app",
    "https://leetcodeurls.netlify.app",
    "https://leetcode-student-data.web.app",
    "https://leetcode-student-data.firebaseapp.com",
]
if getattr(settings, "FRONTEND_ORIGIN", None) and settings.FRONTEND_ORIGIN not in origins:
    origins.append(settings.FRONTEND_ORIGIN.strip())
if getattr(settings, "CORS_ALLOWED_ORIGINS", None):
    for o in settings.CORS_ALLOWED_ORIGINS.split(","):
        o_clean = o.strip()
        if o_clean and o_clean not in origins:
            origins.append(o_clean)
app.add_middleware(GZipMiddleware, minimum_size=500)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+|https://.*\.netlify\.app|https://.*\.web\.app|https://.*\.firebaseapp\.com|https://.*\.vercel\.app|https://.*\.pages\.dev",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "Content-Length", "Content-Type"],
)

# Mount All API Routers (both with /api prefix and root for full compatibility)
app.include_router(auth.router, prefix="/api")
app.include_router(auth.router)
app.include_router(admin.router, prefix="/api")
app.include_router(admin.router)
app.include_router(students.router, prefix="/api")
app.include_router(students.router)
app.include_router(sync.router, prefix="/api")
app.include_router(sync.router)
app.include_router(departments.router, prefix="/api")
app.include_router(departments.router)
app.include_router(sessions.router, prefix="/api")
app.include_router(sessions.router)
app.include_router(leaderboard.router, prefix="/api")
app.include_router(leaderboard.router)
app.include_router(analytics.router, prefix="/api")
app.include_router(analytics.router)
app.include_router(reports.router, prefix="/api")
app.include_router(reports.router)
app.include_router(settings_route.router, prefix="/api")
app.include_router(settings_route.router)
app.include_router(audit.router, prefix="/api")
app.include_router(audit.router)
app.include_router(public.router, prefix="/api")
app.include_router(public.router)
app.include_router(history.router, prefix="/api")
app.include_router(history.router)
app.include_router(risk.router, prefix="/api")
app.include_router(risk.router)
app.include_router(goals.router, prefix="/api")
app.include_router(goals.router)
app.include_router(system_health.router, prefix="/api")
app.include_router(system_health.router)
app.include_router(weekly_contests.router, prefix="/api")
app.include_router(weekly_contests.router)
app.include_router(email_reports.router, prefix="/api")
app.include_router(email_reports.router)
app.include_router(scheduled_reports.router, prefix="/api")
app.include_router(scheduled_reports.router)
app.include_router(certificates.router, prefix="/api")
app.include_router(certificates.router)
app.include_router(leetcode.router, prefix="/api")
app.include_router(leetcode.router)
app.include_router(ai_assistant.router, prefix="/api")
app.include_router(ai_assistant.router)
app.include_router(ai_control_center.router, prefix="/api")
app.include_router(ai_control_center.router)
app.include_router(intelligence.router, prefix="/api")
app.include_router(intelligence.router)
app.include_router(data_issues.router, prefix="/api")
app.include_router(data_issues.router)
app.include_router(command_center.router, prefix="/api")
app.include_router(command_center.router)
app.include_router(leetcode_tracker.router, prefix="/api")
app.include_router(leetcode_tracker.router)
app.include_router(faculty_assignments.router, prefix="/api")
app.include_router(faculty_assignments.router)
app.include_router(institutional_dashboards.router, prefix="/api")
app.include_router(institutional_dashboards.router)
app.include_router(email_campaigns.router, prefix="/api")
app.include_router(email_campaigns.router)
app.include_router(bot_notifications.router, prefix="/api")
app.include_router(bot_notifications.router)
app.include_router(anti_cheat.router, prefix="/api")
app.include_router(anti_cheat.router)
app.include_router(placement_eligibility.router, prefix="/api")
app.include_router(placement_eligibility.router)
app.include_router(gamification.router, prefix="/api")
app.include_router(gamification.router)
app.include_router(accreditation.router, prefix="/api")
app.include_router(deep_tech_intelligence.router, prefix="/api")
app.include_router(deep_tech_intelligence.router)

from backend.routes import stats_snapshot
app.include_router(stats_snapshot.router, prefix="/api")
app.include_router(stats_snapshot.router)

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

# Production Static Build Mount (Serves Frontend SPA bundle on single port)
FRONTEND_DIST = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.exists(FRONTEND_DIST):
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")

logger.info("LeetCode Performance Tracker API is fully ready & live sync engine active.")
# reload trigger
