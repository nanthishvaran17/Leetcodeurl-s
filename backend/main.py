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
    audit, public, sync, history, risk, goals, system_health, weekly_contests,
    scheduled_reports, certificates, data_issues
)
from backend.routes import admin, email_reports, ai_assistant, leetcode, ai_control_center, intelligence
from backend.routes import command_center
from backend import leetcode_tracker

app = FastAPI(
    title="College LeetCode Weekly Tracker API",
    description="Backend API for LeetCode weekly tracking, analytics, leaderboards, Excel/PDF reporting and notifications.",
    version="2.0.0"
)

# Health Endpoint for Render / Cloud Monitors (UptimeRobot HEAD & GET requests) & API Diagnostics
@app.api_route("/health", methods=["GET", "HEAD"])
@app.api_route("/api/health", methods=["GET", "HEAD"])
@app.api_route("/", methods=["GET", "HEAD"])
@app.api_route("/api", methods=["GET", "HEAD"])
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
    "https://leetcodeurls.netlify.app",
    "https://leetcode-student-data.web.app",
    "https://leetcode-student-data.firebaseapp.com",
    "https://leetcodeurl-s-1.onrender.com",
    "https://leetcodeurl-s.onrender.com",
]
from fastapi.middleware.gzip import GZipMiddleware
app.add_middleware(GZipMiddleware, minimum_size=500)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://.*\.netlify\.app|https://.*\.web\.app|https://.*\.firebaseapp\.com",
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
        from backend.database import SessionLocal
        from backend.models import Student, User, LeetCodeProfileStats
        from backend.routes.auth import get_password_hash, verify_password

        with SessionLocal() as db_init:
            try:
                # Reconcile Admin Credentials on Startup
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
                    logger.info(f"[STARTUP_RECONCILE] Created admin user '{admin_username}' with secure password hash.")
                else:
                    admin_user.role = "Admin"  # type: ignore[assignment]
                    admin_user.is_active = True  # type: ignore[assignment]
                    if not verify_password(admin_pass, str(admin_user.hashed_password)):
                        admin_user.hashed_password = get_password_hash(admin_pass)  # type: ignore[assignment]
                        db_init.commit()
                        logger.info(f"[STARTUP_RECONCILE] Reconciled admin user '{admin_username}' password hash.")
            except Exception as _adm_err:
                logger.warning(f"Admin user reconciliation note: {_adm_err}")

            try:
                logger.info("Checking student roster count in single source of truth database...")
                existing_student_cnt = db_init.query(Student).count()

                if existing_student_cnt == 0:
                    logger.info("Brand new database detected (0 students). Seeding initial institutional roster...")
                    try:
                        seed_database()
                        logger.info("Initial database seeding completed successfully.")
                    except Exception as _seed_err:
                        logger.error(f"Error seeding database: {_seed_err}")
                else:
                    logger.info(f"Database contains {existing_student_cnt} existing student records. Preserving database single source of truth.")

                # Check if verified student profile statistics are populated
                verified_stats_cnt = db_init.query(LeetCodeProfileStats).filter(
                    (LeetCodeProfileStats.status.in_(["verified", "success"])) | (LeetCodeProfileStats.total_solved > 0)
                ).count()

                if verified_stats_cnt == 0:
                    logger.info("Unseeded or pending profile stats detected (0 verified profiles). Initializing student profile statistics roster...")
                    try:
                        from backend.assets.reseed_all_stats import reseed_all_student_stats
                        reseed_all_student_stats(sync_firestore=False)
                        from backend.assets.sync_firestore import sync_database_to_firestore
                        asyncio.create_task(asyncio.to_thread(sync_database_to_firestore))
                    except Exception as _reseed_err:
                        logger.warning(f"Reseed all stats note: {_reseed_err}")
            except Exception as _st_err:
                logger.warning(f"Student roster check note: {_st_err}")
    except Exception as e:
        logger.warning(f"Database seed/reseed skipped or noted: {e}")

    try:
        from backend.database import SessionLocal
        from backend.models import SyncJob
        from backend.services.weekly_session_manager import resume_active_weekly_session
        with SessionLocal() as db_recovery:
            # Clean up any zombie sync locks from previous server restarts
            stale_jobs = db_recovery.query(SyncJob).filter(SyncJob.status == "RUNNING").all()
            if stale_jobs:
                for sj in stale_jobs:
                    sj.status = "INTERRUPTED"
                db_recovery.commit()
            asyncio.create_task(resume_active_weekly_session(db_recovery))
    except Exception as _db_err:
        logger.warning(f"Database session recovery skipped: {_db_err}")

    # Ensure all 273 students have a Firestore document with syncStatus:pending in background
    try:
        from backend.assets.sync_firestore import initialize_pending_records
        asyncio.create_task(asyncio.to_thread(initialize_pending_records))
    except Exception as _init_err:
        logger.warning(f"Firestore pending init note: {_init_err}")

    if not is_vercel and SCHEDULER_AVAILABLE:
        logger.info("Starting background scheduler...")
        try:
            start_scheduler()
            from backend.services.schedule_service import get_or_create_default_schedule, register_apscheduler_job
            with SessionLocal() as _sched_db:
                _cfg = get_or_create_default_schedule(_sched_db)
                register_apscheduler_job(_cfg)
        except Exception as e:
            logger.warning(f"Scheduler initialization note: {e}")
    elif not SCHEDULER_AVAILABLE:
        logger.warning("Scheduler skipped — pandas/numpy not available.")
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

