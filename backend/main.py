import os
import json
import asyncio
import secrets
import string
from contextlib import asynccontextmanager
from typing import Optional
from fastapi import FastAPI, Request, Response, Depends, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.config import settings
from backend.database import engine, get_db, SessionLocal
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
    deep_tech_intelligence, url_import, contest_integrity, notifications, messaging, downloads, report_jobs
)
from backend.routes import admin, email_reports, ai_assistant, leetcode, ai_control_center, intelligence, nlci, hr_candidate_finder
from backend.routes import command_center, scheduler
from backend import leetcode_tracker
from backend.services.heartbeat_service import get_deep_health_telemetry
from backend.websocket_manager import manager


# =====================================================================
# 1. NON-BLOCKING ASYNCHRONOUS INITIALIZATION & LIFESPAN
# =====================================================================

async def _deferred_startup_tasks():
    """Executes background DB migrations, admin reconcile, and scheduler asynchronously after port binding."""
    logger.info("[STARTUP] Running background post-bind initialization...")

    def _run_safety_schema_migration():
        """
        Idempotent safety migration: adds any missing columns directly via raw SQL.
        This runs EVERY startup and is a guaranteed no-op if columns already exist.
        It runs BEFORE Alembic so that even if Alembic has issues, the schema is correct.
        """
        try:
            with engine.connect() as conn:
                db_url_str = str(engine.url)
                is_pg = "postgresql" in db_url_str or "postgres" in db_url_str

                if is_pg:
                    # Execute each ALTER TABLE in an isolated atomic transaction to prevent multi-table deadlocks
                    pg_statements = [
                        """
                        ALTER TABLE students
                            ADD COLUMN IF NOT EXISTS primary_leetcode_id VARCHAR(100),
                            ADD COLUMN IF NOT EXISTS secondary_leetcode_id VARCHAR(100),
                            ADD COLUMN IF NOT EXISTS secondary_status VARCHAR(50) DEFAULT 'none';
                        """,
                        """
                        ALTER TABLE student_contest_participations
                            ADD COLUMN IF NOT EXISTS official_attendance_state VARCHAR(30),
                            ADD COLUMN IF NOT EXISTS is_frozen BOOLEAN DEFAULT FALSE,
                            ADD COLUMN IF NOT EXISTS frozen_at TIMESTAMP WITH TIME ZONE,
                            ADD COLUMN IF NOT EXISTS post_contest_solves_count INTEGER DEFAULT 0,
                            ADD COLUMN IF NOT EXISTS solved_problems TEXT,
                            ADD COLUMN IF NOT EXISTS confidence VARCHAR(50) DEFAULT 'HIGH',
                            ADD COLUMN IF NOT EXISTS verification_level VARCHAR(50),
                            ADD COLUMN IF NOT EXISTS verification_evidence TEXT;
                        """,
                        """
                        ALTER TABLE weekly_session_snapshots
                            ADD COLUMN IF NOT EXISTS is_sequence_broken BOOLEAN DEFAULT FALSE;
                        """,
                        """
                        ALTER TABLE admin_audit_logs
                            ADD COLUMN IF NOT EXISTS audit_id VARCHAR(100),
                            ADD COLUMN IF NOT EXISTS event_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                            ADD COLUMN IF NOT EXISTS admin_user_id INTEGER,
                            ADD COLUMN IF NOT EXISTS admin_name VARCHAR(150),
                            ADD COLUMN IF NOT EXISTS admin_email VARCHAR(150),
                            ADD COLUMN IF NOT EXISTS admin_role VARCHAR(50) DEFAULT 'ADMIN',
                            ADD COLUMN IF NOT EXISTS access_level VARCHAR(50) DEFAULT 'LEVEL_1',
                            ADD COLUMN IF NOT EXISTS action VARCHAR(100),
                            ADD COLUMN IF NOT EXISTS action_type VARCHAR(50) DEFAULT 'GENERAL',
                            ADD COLUMN IF NOT EXISTS action_classification VARCHAR(50) DEFAULT 'SECURITY_ACCESS',
                            ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'SUCCESS',
                            ADD COLUMN IF NOT EXISTS severity VARCHAR(30) DEFAULT 'INFO',
                            ADD COLUMN IF NOT EXISTS target_type VARCHAR(50),
                            ADD COLUMN IF NOT EXISTS target_id VARCHAR(100),
                            ADD COLUMN IF NOT EXISTS resource_name VARCHAR(150),
                            ADD COLUMN IF NOT EXISTS route VARCHAR(255),
                            ADD COLUMN IF NOT EXISTS http_method VARCHAR(10),
                            ADD COLUMN IF NOT EXISTS ip_address VARCHAR(50),
                            ADD COLUMN IF NOT EXISTS client_ip VARCHAR(50),
                            ADD COLUMN IF NOT EXISTS ip_version VARCHAR(10) DEFAULT 'IPv4',
                            ADD COLUMN IF NOT EXISTS session_id VARCHAR(100),
                            ADD COLUMN IF NOT EXISTS request_id VARCHAR(100),
                            ADD COLUMN IF NOT EXISTS correlation_id VARCHAR(100),
                            ADD COLUMN IF NOT EXISTS browser VARCHAR(100),
                            ADD COLUMN IF NOT EXISTS browser_version VARCHAR(50),
                            ADD COLUMN IF NOT EXISTS operating_system VARCHAR(100),
                            ADD COLUMN IF NOT EXISTS device_type VARCHAR(50),
                            ADD COLUMN IF NOT EXISTS user_agent_category VARCHAR(100),
                            ADD COLUMN IF NOT EXISTS user_agent VARCHAR(500),
                            ADD COLUMN IF NOT EXISTS authentication_status VARCHAR(50) DEFAULT 'AUTHENTICATED',
                            ADD COLUMN IF NOT EXISTS authorization_result VARCHAR(50) DEFAULT 'ALLOWED',
                            ADD COLUMN IF NOT EXISTS permission_checked VARCHAR(100),
                            ADD COLUMN IF NOT EXISTS risk_level VARCHAR(30) DEFAULT 'LOW',
                            ADD COLUMN IF NOT EXISTS denial_reason TEXT,
                            ADD COLUMN IF NOT EXISTS request_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                            ADD COLUMN IF NOT EXISTS response_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                            ADD COLUMN IF NOT EXISTS response_status INTEGER DEFAULT 200,
                            ADD COLUMN IF NOT EXISTS response_time_ms DOUBLE PRECISION DEFAULT 0.0,
                            ADD COLUMN IF NOT EXISTS trace_id VARCHAR(100),
                            ADD COLUMN IF NOT EXISTS event_hash VARCHAR(100),
                            ADD COLUMN IF NOT EXISTS previous_event_hash VARCHAR(100),
                            ADD COLUMN IF NOT EXISTS integrity_status VARCHAR(30) DEFAULT 'VERIFIED',
                            ADD COLUMN IF NOT EXISTS institution_id VARCHAR(50) DEFAULT 'NEC',
                            ADD COLUMN IF NOT EXISTS institution_branding_version VARCHAR(50) DEFAULT 'v1.0',
                            ADD COLUMN IF NOT EXISTS institution_logo_reference VARCHAR(100) DEFAULT 'nandha_emblem.png',
                            ADD COLUMN IF NOT EXISTS description TEXT,
                            ADD COLUMN IF NOT EXISTS metadata_json JSONB,
                            ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
                        """,
                        """
                        ALTER TABLE weekly_sessions
                            ADD COLUMN IF NOT EXISTS manual_review_required_at TIMESTAMP WITH TIME ZONE,
                            ADD COLUMN IF NOT EXISTS manual_review_reason TEXT,
                            ADD COLUMN IF NOT EXISTS last_successful_source_fetch TIMESTAMP WITH TIME ZONE,
                            ADD COLUMN IF NOT EXISTS last_reconciliation_attempt TIMESTAMP WITH TIME ZONE,
                            ADD COLUMN IF NOT EXISTS reconciliation_failure_count INTEGER DEFAULT 0,
                            ADD COLUMN IF NOT EXISTS last_error_code VARCHAR(100),
                            ADD COLUMN IF NOT EXISTS last_error_message_safe TEXT,
                            ADD COLUMN IF NOT EXISTS finalization_method VARCHAR(50),
                            ADD COLUMN IF NOT EXISTS finalized_by VARCHAR(150);
                        """
                    ]
                    for stmt in pg_statements:
                        try:
                            with engine.begin() as atomic_conn:
                                atomic_conn.execute(text(stmt))
                        except Exception as _st_err:
                            logger.warning(f"[STARTUP] Atomic migration stmt note: {_st_err}")
                else:
                    # SQLite dialect fallback column additions
                    try:
                        res = conn.execute(text("PRAGMA table_info(student_contest_participations)")).fetchall()
                        scp_cols = {r[1] for r in res}
                        if scp_cols:
                            sqlite_additions = [
                                ("official_attendance_state", "ALTER TABLE student_contest_participations ADD COLUMN official_attendance_state VARCHAR(30)"),
                                ("is_frozen", "ALTER TABLE student_contest_participations ADD COLUMN is_frozen BOOLEAN DEFAULT 0"),
                                ("frozen_at", "ALTER TABLE student_contest_participations ADD COLUMN frozen_at DATETIME"),
                                ("post_contest_solves_count", "ALTER TABLE student_contest_participations ADD COLUMN post_contest_solves_count INTEGER DEFAULT 0"),
                                ("solved_problems", "ALTER TABLE student_contest_participations ADD COLUMN solved_problems TEXT"),
                                ("confidence", "ALTER TABLE student_contest_participations ADD COLUMN confidence VARCHAR(50) DEFAULT 'HIGH'")
                            ]
                            for col_name, sql_stmt in sqlite_additions:
                                if col_name not in scp_cols:
                                    conn.execute(text(sql_stmt))
                    except Exception as _sq_err:
                        logger.warning(f"[STARTUP] SQLite safety column addition note: {_sq_err}")

                # Backfill primary_leetcode_id from username
                conn.execute(text("""
                    UPDATE students
                    SET primary_leetcode_id = username
                    WHERE primary_leetcode_id IS NULL AND username IS NOT NULL
                """))
                # Ensure index exists (CREATE INDEX IF NOT EXISTS is safe)
                conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS ix_students_primary_leetcode_id
                    ON students (primary_leetcode_id)
                """))
                conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS ix_students_secondary_leetcode_id
                    ON students (secondary_leetcode_id)
                """))
                # Ensure weekly_verification_records table exists
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS weekly_verification_records (
                        id SERIAL PRIMARY KEY,
                        student_id INTEGER NOT NULL REFERENCES students(id),
                        verification_week INTEGER NOT NULL,
                        notification_type VARCHAR(50) NOT NULL,
                        primary_solved INTEGER,
                        secondary_solved INTEGER,
                        status VARCHAR(30),
                        email_dispatched BOOLEAN,
                        timestamp TIMESTAMP,
                        CONSTRAINT uq_weekly_verification_record
                            UNIQUE (student_id, verification_week, notification_type)
                    )
                """))
                conn.commit()
                logger.info("[STARTUP] Safety schema migration: all required columns verified/added OK.")
        except Exception as _schema_err:
            logger.error(f"[STARTUP] Safety schema migration failed: {_schema_err}")

    def _run_blocking_migrations():
        # Run safety migration FIRST (idempotent raw SQL - never fails if DB is reachable)
        _run_safety_schema_migration()

        try:
            from backend.migrate_db import run_db_migrations
            run_db_migrations()
        except Exception as _mig_err1:
            logger.warning(f"[STARTUP] Database migrate_db note: {_mig_err1}")
            
        try:
            from backend.database import run_migrations
            run_migrations()
        except Exception as _mig_err2:
            logger.warning(f"[STARTUP] Database run_migrations note: {_mig_err2}")

    try:
        await asyncio.to_thread(_run_blocking_migrations)
    except Exception as _mig_err:
        logger.warning(f"[STARTUP] Database migration note: {_mig_err}")

    def _run_blocking_db_init():
        from backend.database import SessionLocal
        from backend.models import User, SyncJob
        from backend.routes.auth import get_password_hash, verify_password

        with SessionLocal() as db_init:
            try:
                admin_username = getattr(settings, "ADMIN_USERNAME", "admin").strip()
                admin_email = getattr(settings, "ADMIN_EMAIL", "nanthishvaran17@gmail.com").strip().lower()
                admin_pass = getattr(settings, "ADMIN_PASSWORD", secrets.token_urlsafe(16)).strip()

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
                stale_jobs = db_init.query(SyncJob).filter(SyncJob.status == "RUNNING").all()
                if stale_jobs:
                    for sj in stale_jobs:
                        sj.status = "INTERRUPTED"
                    db_init.commit()
            except Exception as _sj_err:
                logger.warning(f"[STARTUP] Sync job recovery note: {_sj_err}")

    try:
        await asyncio.to_thread(_run_blocking_db_init)

        # Weekly session resume is async, run directly
        try:
            from backend.database import SessionLocal
            with SessionLocal() as db_init_async:
                from backend.services.weekly_session_manager import resume_active_weekly_session
                await resume_active_weekly_session(db_init_async)
        except Exception as _sess_err:
            logger.warning(f"[STARTUP] Weekly session resume note: {_sess_err}")

    except Exception as e:
        logger.warning(f"[STARTUP] Deferred DB init note: {e}")

    try:
        from backend.assets.sync_firestore import initialize_pending_records
        await asyncio.to_thread(initialize_pending_records)
    except Exception as _init_err:
        logger.warning(f"[STARTUP] Firestore pending init note: {_init_err}")

    # STEP 3: SCHEDULER START + MISSED JOB RECOVERY 
    is_vercel = os.environ.get("VERCEL") == "1" or os.environ.get("VERCEL_ENV")
    run_scheduler_in_web = os.environ.get("RUN_SCHEDULER_IN_WEB", "true").lower() == "true"
    if not is_vercel and SCHEDULER_AVAILABLE and run_scheduler_in_web:
        try:
            logger.info("[STARTUP] Step 3: Scheduler Initialization...")
            start_scheduler()
            from backend.services.schedule_service import get_or_create_default_schedule, register_apscheduler_job
            with SessionLocal() as _sched_db:
                _cfg = get_or_create_default_schedule(_sched_db)
                register_apscheduler_job(_cfg)
                
            # Pre-generate weekly report cache in background thread for instant user download without blocking startup
            try:
                from backend.services.pregenerated_report_service import pregenerate_all_weekly_reports
                def _run_bg_pregen():
                    with SessionLocal() as _report_db:
                        pregenerate_all_weekly_reports(_report_db)
                await asyncio.to_thread(_run_bg_pregen)
                logger.info("[STARTUP] Weekly report pre-generation worker completed.")
            except Exception as _p_err:
                logger.warning(f"[STARTUP] Weekly report pre-generation note: {_p_err}")

            logger.info("[STARTUP] Step 3: Scheduler started. Checking for missed jobs...")


            # MISSED JOB RECOVERY 
            # If server was down over a Sunday window, detect and recover safely.
            try:
                import datetime as _dt
                from backend.time_utils import IST
                from backend.database import SessionLocal as _SL
                from backend.models import WeeklySession, ScheduledJobExecution

                now_ist = _dt.datetime.now(IST)
                # Only attempt recovery if current time is Sunday AFTER 08:00 IST
                if now_ist.weekday() == 6 and now_ist.hour >= 8:
                    with _SL() as _recovery_db:
                        today_str = now_ist.strftime("%Y-%m-%d")
                        existing_session = _recovery_db.query(WeeklySession).filter(
                            WeeklySession.session_date == today_str
                        ).first()

                        if not existing_session or existing_session.status in ("SCHEDULED", "DISCOVERED"):
                            logger.warning(
                                f"[STARTUP] MISSED SCHEDULE DETECTED — Sunday {today_str} "
                                f"at {now_ist.strftime('%H:%M IST')}. Triggering safe recovery..."
                            )
                            # Record recovery attempt
                            recovery_record = ScheduledJobExecution(
                                job_id="startup_missed_job_recovery",
                                job_type="RECOVERY",
                                scheduled_at=now_ist.replace(hour=8, minute=0, second=0, microsecond=0),
                                started_at=now_ist,
                                status="RUNNING"
                            )
                            _recovery_db.add(recovery_record)
                            _recovery_db.commit()

                            # Fire appropriate recovery phase based on current time
                            from backend.services.sunday_autopilot import sunday_autopilot
                            if now_ist.hour < 9 or (now_ist.hour == 9 and now_ist.minute < 30):
                                logger.info("[STARTUP RECOVERY] Running Phase 1 (Pre-Flight) + Phase 2 (Baseline)...")
                                sunday_autopilot.phase_1_preflight_0755(_recovery_db)
                            elif now_ist.hour == 9 and now_ist.minute >= 30:
                                logger.info("[STARTUP RECOVERY] Running Phase 4 (Finalization)...")
                                asyncio.create_task(
                                    sunday_autopilot.phase_4_finalization_0930(_recovery_db)
                                )
                            else:
                                logger.info("[STARTUP RECOVERY] Contest window passed. Attempting finalization.")
                                asyncio.create_task(
                                    sunday_autopilot.phase_4_finalization_0930(_recovery_db)
                                )

                            recovery_record.status = "COMPLETED"
                            recovery_record.completed_at = _dt.datetime.utcnow()
                            _recovery_db.commit()
                            logger.info("[STARTUP] Missed job recovery completed.")
                        else:
                            logger.info(f"[STARTUP] No missed jobs detected. Session {today_str} status: {existing_session.status}")
            except Exception as _recovery_err:
                logger.warning(f"[STARTUP] Missed job recovery note: {_recovery_err}")

            # STEP 4: CONTEST DISCOVERY 
            try:
                logger.info("[STARTUP] Step 4: Contest Discovery...")
                from backend.services.contest_discovery import discover_contest_metadata
                meta = discover_contest_metadata()
                logger.info(
                    f"[STARTUP] Contest Discovery: {meta.get('contest_name')} "
                    f"({meta.get('status')}) on {meta.get('raw_date')}"
                )
            except Exception as _disc_err:
                logger.warning(f"[STARTUP] Contest discovery note: {_disc_err}")

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
    version="2.2.0",
    default_response_class=JSONResponse,
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
        "version": "2.2.0"
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
            "version": "2.2.0"
        }
    except Exception as exc:
        response.status_code = 503
        return {
            "status": "not_ready",
            "database": "unreachable",
            "error": str(exc),
            "version": "2.2.0"
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
    "https://leetcodeurl-s-roan.vercel.app",
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
    "http://localhost",
    "https://localhost",
    "capacitor://localhost",
    "ionic://localhost"
]
if getattr(settings, "FRONTEND_ORIGIN", None) and settings.FRONTEND_ORIGIN.strip() not in origins:
    origins.append(settings.FRONTEND_ORIGIN.strip())
if getattr(settings, "CORS_ALLOWED_ORIGINS", None):
    for o in settings.CORS_ALLOWED_ORIGINS.split(","):
        o_clean = o.strip()
        if o_clean and o_clean not in origins:
            origins.append(o_clean)
# Enable fast, lightweight GZip compression on responses > 500 bytes across all environments
app.add_middleware(GZipMiddleware, minimum_size=500, compresslevel=5)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://.*\.netlify\.app|https://.*\.web\.app|https://.*\.firebaseapp\.com|https://.*\.vercel\.app|https://.*\.pages\.dev|https://.*\.loca\.lt|http://192\.168\..*|http://10\..*|http://172\.(1[6-9]|2[0-9]|3[01])\..*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "Content-Length", "Content-Type", "X-Report-Cache-Hit", "X-Report-Lookup-Ms"],
)

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    return response

# =====================================================================
# ULTRA-FAST SUB-MILLISECOND IN-MEMORY API RESPONSE CACHE
# =====================================================================
_API_MEMORY_CACHE: dict = {}
_MAX_CACHE_ENTRIES = 500
_CACHE_TTL_MAP: dict = {
    "/api/public/stats": 120,
    "/api/public/leaderboard": 60,
    "/api/sessions/dashboard-summary": 60,
    "/api/students": 60,
    "/api/students/leaderboard-fast": 60,
    "/api/departments": 300,
    "/api/analytics/department-comparison": 120,
    "/api/analytics/data-quality": 120,
    "/api/weekly-contests/active-contest": 30,
    "/api/placement-eligibility/students": 120,
    "/api/gamification/leaderboard": 60,
}

def purge_api_memory_cache():
    """Purges in-memory API response cache on data mutation (POST/PUT/DELETE)."""
    _API_MEMORY_CACHE.clear()

def _cleanup_expired_cache_entries(now: float):
    """Purges stale cache items to keep RAM strictly bounded."""
    if len(_API_MEMORY_CACHE) > _MAX_CACHE_ENTRIES:
        stale_keys = [k for k, v in _API_MEMORY_CACHE.items() if now >= v.get("expires_at", 0)]
        for sk in stale_keys:
            _API_MEMORY_CACHE.pop(sk, None)
        if len(_API_MEMORY_CACHE) > _MAX_CACHE_ENTRIES:
            # Drop oldest 20% if still over limit
            sorted_keys = sorted(_API_MEMORY_CACHE.keys(), key=lambda k: _API_MEMORY_CACHE[k].get("expires_at", 0))
            for k in sorted_keys[:60]:
                _API_MEMORY_CACHE.pop(k, None)

def _add_cors_headers_to_response(request, response_headers) -> None:
    """Attaches origin-specific CORS headers to response headers dict or MutableHeaders."""
    origin = request.headers.get("origin")
    if origin:
        import re
        allowed_regex = r"https://.*\.netlify\.app|https://.*\.web\.app|https://.*\.firebaseapp\.com|https://.*\.vercel\.app|https://.*\.pages\.dev|https://.*\.loca\.lt"
        if origin in origins or re.match(allowed_regex, origin):
            response_headers["Access-Control-Allow-Origin"] = origin
            response_headers["Access-Control-Allow-Credentials"] = "true"
            response_headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
            response_headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type, Accept, Origin, User-Agent, DNT, Cache-Control, X-Mx-ReqToken, X-Requested-With, Bypass-Tunnel-Reminder"
            response_headers["Access-Control-Expose-Headers"] = "Content-Disposition, Content-Length, Content-Type, X-Cache"

@app.middleware("http")
async def ultra_fast_memory_cache_middleware(request, call_next):
    method = request.method
    path = request.url.path

    # Invalidate cache on mutations
    if method in ("POST", "PUT", "DELETE", "PATCH"):
        purge_api_memory_cache()
        response = await call_next(request)
        _add_cors_headers_to_response(request, response.headers)
        return response

    if method == "OPTIONS":
        response = await call_next(request)
        _add_cors_headers_to_response(request, response.headers)
        return response

    # Serve cached responses in < 1ms for high-frequency GET queries with parameter & role isolation
    if method == "GET" and path in _CACHE_TTL_MAP:
        import time
        from backend.middleware.performance_profiler import record_cache_hit, record_cache_miss
        now = time.time()
        auth_hdr = request.headers.get("authorization", "")
        cache_key = f"{path}?{request.url.query}#auth:{hash(auth_hdr)}"
        cached_item = _API_MEMORY_CACHE.get(cache_key)

        if cached_item and now < cached_item["expires_at"]:
            record_cache_hit()
            from fastapi.responses import Response as FastResponse
            res_headers = dict(cached_item.get("headers", {}))
            res_headers["X-Cache"] = "HIT-FASTAPI-RAM"
            res_headers["Cache-Control"] = f"private, max-age={_CACHE_TTL_MAP[path]}"
            _add_cors_headers_to_response(request, res_headers)
            return FastResponse(
                content=cached_item["body"],
                status_code=cached_item["status"],
                headers=res_headers
            )
        else:
            record_cache_miss()

    response = await call_next(request)

    # Store in memory cache if matching fast endpoints
    if method == "GET" and path in _CACHE_TTL_MAP and response.status_code == 200:
        import time
        try:
            now = time.time()
            auth_hdr = request.headers.get("authorization", "")
            cache_key = f"{path}?{request.url.query}#auth:{hash(auth_hdr)}"
            
            body = [chunk async for chunk in response.body_iterator]
            full_body = b"".join(body)
            content_type = response.headers.get("content-type", "application/json")
            
            _cleanup_expired_cache_entries(now)
            _API_MEMORY_CACHE[cache_key] = {
                "body": full_body,
                "status": response.status_code,
                "content_type": content_type,
                "headers": dict(response.headers),
                "expires_at": now + _CACHE_TTL_MAP[path]
            }
            from fastapi.responses import Response as FastResponse
            res_headers = dict(response.headers)
            _add_cors_headers_to_response(request, res_headers)
            return FastResponse(
                content=full_body,
                status_code=response.status_code,
                headers=res_headers
            )
        except Exception:
            pass

    _add_cors_headers_to_response(request, response.headers)
    return response

@app.middleware("http")
async def add_security_headers_and_performance_middleware(request, call_next):
    response = await call_next(request)
    path = request.url.path
    
    # 1. Standard Production Security Headers (Defense-in-Depth)
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=()"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    _add_cors_headers_to_response(request, response.headers)
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://apis.google.com https://*.firebaseapp.com; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com data:; "
        "img-src 'self' data: https: blob:; "
        "connect-src 'self' https: wss: ws:; "
        "frame-ancestors 'self';"
    )

    # 2. Performance Cache Control
    if path.startswith("/assets/") or path.endswith((".js", ".css", ".png", ".jpg", ".ico", ".svg", ".woff2")):
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    elif path.startswith("/api/public/") or path.startswith("/api/stats"):
        response.headers["Cache-Control"] = "public, max-age=60, s-maxage=60"
        
    return response

# Mount All API Routers
# RULE: Routers whose own prefix already starts with /api are mounted ONCE (no extra prefix).
#       Routers with short/no prefix get BOTH a /api-prefixed and root mount for compat.

# auth: prefix="/api/auth" (self-prefixed) — mount once
app.include_router(auth.router)
# notifications: prefix="/api/notifications" (self-prefixed) — mount once
app.include_router(notifications.router)
# messaging: prefix="/api/messaging"
app.include_router(messaging.router)
# admin: prefix="/api/admin" (self-prefixed) — mount once
app.include_router(admin.router)
# students: prefix="/api/students" (self-prefixed) — mount once
app.include_router(students.router)
app.include_router(hr_candidate_finder.router)
# sync: typically short prefix — keep both mounts
app.include_router(sync.router, prefix="/api")
app.include_router(sync.router)
# departments: prefix="/api/departments" (self-prefixed)
app.include_router(departments.router)
# sessions: prefix="/api/sessions" (self-prefixed)
app.include_router(sessions.router)
# leaderboard: prefix="/api/leaderboard" (self-prefixed)
app.include_router(leaderboard.router)
# analytics: prefix="/api/analytics" (self-prefixed)
app.include_router(analytics.router)
# downloads: prefix="/api/downloads" (self-prefixed)
app.include_router(downloads.router)
# reports: prefix="/api/reports" (self-prefixed)
app.include_router(reports.router)
app.include_router(report_jobs.router)
# settings: prefix="/api/settings" (self-prefixed)
app.include_router(settings_route.router)
# audit: prefix="/api/audit" (self-prefixed)
app.include_router(audit.router)
# public: prefix="/api/public" (self-prefixed)
app.include_router(public.router)
# history: prefix="/api" and root
app.include_router(history.router, prefix="/api")
app.include_router(history.router)
# risk: prefix="/api/risk" (self-prefixed)
app.include_router(risk.router)
# goals: prefix="/api/goals" (self-prefixed)
app.include_router(goals.router)
# system_health: prefix="/api/system" (self-prefixed)
app.include_router(system_health.router)
# weekly_contests: prefix="/contests" — keep both
app.include_router(weekly_contests.router, prefix="/api")
app.include_router(weekly_contests.router)
# email_reports: prefix="/api/email" (self-prefixed) — mount ONCE to fix /api/api/email
app.include_router(email_reports.router)
# scheduled_reports: prefix="/api/system/schedule" (self-prefixed)
app.include_router(scheduled_reports.router)
# certificates — short prefix, keep both
app.include_router(certificates.router, prefix="/api")
app.include_router(certificates.router)
# leetcode — short prefix
app.include_router(leetcode.router, prefix="/api")
app.include_router(leetcode.router)
# ai_assistant — short prefix
app.include_router(ai_assistant.router, prefix="/api")
app.include_router(ai_assistant.router)
# ai_control_center — short prefix
app.include_router(ai_control_center.router, prefix="/api")
app.include_router(ai_control_center.router)
# intelligence: prefix="/api/intelligence" (self-prefixed)
app.include_router(intelligence.router)
# nlci: prefix="/api/nlci" (self-prefixed)
app.include_router(nlci.router)
# data_issues: prefix="/api/data-issues" (self-prefixed)
app.include_router(data_issues.router)
# command_center — short prefix
app.include_router(command_center.router, prefix="/api")
app.include_router(command_center.router)
# leetcode_tracker — short prefix
app.include_router(leetcode_tracker.router, prefix="/api")
app.include_router(leetcode_tracker.router)
# faculty_assignments — short prefix, keep both + faculty aliases
app.include_router(faculty_assignments.router, prefix="/api")
app.include_router(faculty_assignments.router)
app.include_router(faculty_assignments.router, prefix="/api/faculty", tags=["Faculty"])
app.include_router(faculty_assignments.router, prefix="/faculty", tags=["Faculty"])
# institutional_dashboards — short prefix
app.include_router(institutional_dashboards.router, prefix="/api")
app.include_router(institutional_dashboards.router)
# email_campaigns — short prefix
app.include_router(email_campaigns.router, prefix="/api")
app.include_router(email_campaigns.router)
# bot_notifications — short prefix
app.include_router(bot_notifications.router, prefix="/api")
app.include_router(bot_notifications.router)
# anti_cheat — short prefix
app.include_router(anti_cheat.router, prefix="/api")
app.include_router(anti_cheat.router)
# placement_eligibility — short prefix
app.include_router(placement_eligibility.router, prefix="/api")
app.include_router(placement_eligibility.router)
# gamification — short prefix
app.include_router(gamification.router, prefix="/api")
app.include_router(gamification.router)
# accreditation — short prefix
app.include_router(accreditation.router, prefix="/api")
# deep_tech_intelligence: prefix="/api/intelligence/deep-tech" (self-prefixed)
app.include_router(deep_tech_intelligence.router)
# scheduler — no prefix
app.include_router(scheduler.router)


from backend.routes import stats_snapshot, staff_verification
app.include_router(stats_snapshot.router, prefix="/api")
app.include_router(stats_snapshot.router)
app.include_router(url_import.router, prefix="/api")
app.include_router(contest_integrity.router, prefix="/api")
app.include_router(staff_verification.router)
# Mount Static File Directories
is_vercel = os.environ.get("VERCEL") == "1" or os.environ.get("VERCEL_ENV")
if is_vercel:

    REPORTS_DIR = "/tmp/reports"
else:
    REPORTS_DIR = os.path.join(os.path.dirname(__file__), "reports")

try:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    os.makedirs(REPORTS_DIR, exist_ok=True)
    os.makedirs(os.path.join(BASE_DIR, "static"), exist_ok=True)
    
    app.mount("/static/reports", StaticFiles(directory=REPORTS_DIR), name="reports")
    app.mount("/static/assets", StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="assets")
except Exception as e:
    logger.warning(f"Could not mount static reports directory: {e}")

@app.websocket("/ws/notifications")
@app.websocket("/ws/leaderboard")
async def websocket_leaderboard_endpoint(websocket: WebSocket, token: Optional[str] = None):
    """Authenticated real-time WebSocket endpoint for notifications and leaderboard events."""
    connected = await manager.connect(websocket, token=token)
    if not connected:
        return
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
            else:
                # Handle SUBSCRIBE / UNSUBSCRIBE for contest-scoped events
                try:
                    msg = json.loads(data)
                    if msg.get("action") == "SUBSCRIBE" and msg.get("session_id"):
                        manager.subscribe_session(websocket, int(msg["session_id"]))
                        await websocket.send_text(json.dumps({"type": "SUBSCRIBED", "session_id": msg["session_id"]}))
                    elif msg.get("action") == "UNSUBSCRIBE" and msg.get("session_id"):
                        manager.unsubscribe_session(websocket, int(msg["session_id"]))
                        await websocket.send_text(json.dumps({"type": "UNSUBSCRIBED", "session_id": msg["session_id"]}))
                    
                    # Messaging: Track active conversation to prevent duplicate FCM pushes
                    elif msg.get("action") == "VIEW_CONVERSATION" and msg.get("conversation_id"):
                        manager.set_active_conversation(websocket, msg["conversation_id"])
                        await websocket.send_text(json.dumps({"type": "VIEWING_CONVERSATION", "conversation_id": msg["conversation_id"]}))
                    elif msg.get("action") == "LEAVE_CONVERSATION":
                        manager.set_active_conversation(websocket, None)
                        await websocket.send_text(json.dumps({"type": "LEFT_CONVERSATION"}))
                        
                except (json.JSONDecodeError, ValueError):
                    pass  # Non-JSON messages (e.g. plain strings) — ignore
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.websocket("/ws/contest/{contest_id}")
async def websocket_contest_endpoint(websocket: WebSocket, contest_id: str, token: Optional[str] = None):
    """
    Persistent WebSocket Endpoint for True Live Contest Monitoring.
    Supports:
    - Optional JWT token authentication (query param: ?token=<jwt>)
    - Session subscription: send {"action": "SUBSCRIBE", "session_id": N}
    - Session unsubscribe: send {"action": "UNSUBSCRIBE", "session_id": N}
    - Initial snapshot push on connect
    - GET_SNAPSHOT, GET_MISSED_EVENTS version recovery
    """
    await manager.connect(websocket, token=token)
    db = SessionLocal()
    try:
        from backend.services.live_contest_monitor_engine import live_contest_monitor_engine
        # Push initial snapshot immediately on connect
        snapshot = live_contest_monitor_engine.get_live_snapshot(db, contest_id)
        await websocket.send_text(json.dumps(snapshot))

        while True:
            raw_msg = await websocket.receive_text()
            if raw_msg == "ping":
                await websocket.send_text("pong")
                continue
            try:
                msg = json.loads(raw_msg)
                msg_type = msg.get("type")
                action = msg.get("action")

                # Session subscription protocol
                if action == "SUBSCRIBE" and msg.get("session_id"):
                    manager.subscribe_session(websocket, int(msg["session_id"]))
                    await websocket.send_text(json.dumps({"type": "SUBSCRIBED", "session_id": msg["session_id"]}))
                    continue
                elif action == "UNSUBSCRIBE" and msg.get("session_id"):
                    manager.unsubscribe_session(websocket, int(msg["session_id"]))
                    await websocket.send_text(json.dumps({"type": "UNSUBSCRIBED", "session_id": msg["session_id"]}))
                    continue

                if msg_type == "GET_SNAPSHOT":
                    snap = live_contest_monitor_engine.get_live_snapshot(db, contest_id)
                    await websocket.send_text(json.dumps(snap))
                elif msg_type == "GET_MISSED_EVENTS":
                    last_ver = msg.get("last_received_version", 0)
                    missed = live_contest_monitor_engine.get_missed_events(db, contest_id, last_ver)
                    await websocket.send_text(json.dumps({
                        "event": "MISSED_EVENTS_RESPONSE",
                        "type": "MISSED_EVENTS_RESPONSE",
                        "contest_id": contest_id,
                        "events": missed
                    }))
            except Exception as parse_err:
                logger.warning(f"[WS_CONTEST] Error processing message: {parse_err}")
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    finally:
        db.close()

@app.post("/api/contests/{contest_id}/start-live-monitor")
async def start_live_contest_monitor_api(contest_id: str):
    """Triggers backend live monitoring engine for all registered students."""
    from backend.services.live_contest_monitor_engine import live_contest_monitor_engine
    return await live_contest_monitor_engine.start_monitoring(contest_id)

@app.get("/api/contests/{contest_id}/live-snapshot")
def get_live_contest_snapshot_api(contest_id: str, db: Session = Depends(get_db)):
    """REST fallback endpoint returning live snapshot."""
    from backend.services.live_contest_monitor_engine import live_contest_monitor_engine
    return live_contest_monitor_engine.get_live_snapshot(db, contest_id)

from fastapi import HTTPException
from fastapi.responses import FileResponse

@app.get("/api/download/apk")
@app.get("/download/apk")
def download_android_apk_endpoint():
    """Serves the official Nandha LeetCode Intelligence Android APK package."""
    apk_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "Nandha_LeetCode_Intelligence_v2_latest.apk"))
    if not os.path.exists(apk_path):
        raise HTTPException(status_code=404, detail="Android APK package is currently updating on the server. Please try again in a few moments.")
    return FileResponse(
        path=apk_path,
        media_type="application/vnd.android.package-archive",
        filename="Nandha_LeetCode_Intelligence_v2_latest.apk"
    )


# Production Static Build Mount (Serves Frontend SPA bundle on single port)
FRONTEND_DIST = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.exists(FRONTEND_DIST):
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")

logger.info("LeetCode Performance Tracker API is fully ready & live sync engine active.")

# reload trigger
