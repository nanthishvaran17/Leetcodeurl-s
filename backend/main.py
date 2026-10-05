import os
import base64
import json
import asyncio
import secrets
import string
from functools import lru_cache
from contextlib import asynccontextmanager
from typing import Optional
from fastapi import FastAPI, Request, Response, Depends, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse, HTMLResponse, RedirectResponse
try:
    from fastapi.responses import ORJSONResponse
except Exception:
    ORJSONResponse = JSONResponse  # type: ignore
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
from backend.routes import command_center, scheduler, student_reports
from backend import leetcode_tracker
from backend.services.heartbeat_service import get_deep_health_telemetry
from backend.websocket_manager import manager
from backend.cache import cache


# =====================================================================
# 1. NON-BLOCKING ASYNCHRONOUS INITIALIZATION & LIFESPAN
# =====================================================================

async def _deferred_startup_tasks():
    """Executes background DB migrations, admin reconcile, and scheduler asynchronously after port binding."""
    logger.info("[STARTUP] Running background post-bind initialization...")

    def _run_blocking_migrations():
        try:
            from backend.migrate_db import run_db_migrations
            run_db_migrations()
            logger.info("[STARTUP] Database schema migrations and columns verified successfully.")
        except Exception as _mig_err1:
            logger.warning(f"[STARTUP] Database migrate_db note: {_mig_err1}")

        if os.environ.get("RUN_FULL_MIGRATIONS") == "true":
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

        # 1. Admin user reconcile
        try:
            with SessionLocal() as db_admin:
                admin_username = getattr(settings, "ADMIN_USERNAME", "admin").strip()
                admin_email = getattr(settings, "ADMIN_EMAIL", "nanthishvaran17@gmail.com").strip().lower()
                admin_pass = getattr(settings, "ADMIN_PASSWORD", "").strip()

                admin_user = db_admin.query(User).filter(
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
                    db_admin.add(admin_user)
                    db_admin.commit()
                    logger.info(f"[STARTUP] Reconciled initial admin user: {admin_username}")
                else:
                    admin_user.role = "Admin"  # type: ignore
                    admin_user.is_active = True  # type: ignore
                    if not admin_user.hashed_password or not verify_password(admin_pass, str(admin_user.hashed_password)):
                        admin_user.hashed_password = get_password_hash(admin_pass)  # type: ignore
                        db_admin.commit()
        except Exception as _adm_err:
            logger.warning(f"[STARTUP] Admin reconcile note: {_adm_err}")

        # 2. Stale jobs cleanup
        try:
            with SessionLocal() as db_jobs:
                stale_jobs = db_jobs.query(SyncJob).filter(SyncJob.status == "RUNNING").all()
                if stale_jobs:
                    for sj in stale_jobs:
                        sj.status = "INTERRUPTED"  # type: ignore
                    db_jobs.commit()
        except Exception as _sj_err:
            logger.warning(f"[STARTUP] Sync job recovery note: {_sj_err}")

    try:
        await asyncio.to_thread(_run_blocking_db_init)

        # Weekly session resume is async, run directly (session sync deferred to worker/on-demand for OOM prevention)
        try:
            from backend.database import SessionLocal
            with SessionLocal() as db_init_async:
                from backend.services.weekly_session_manager import resume_active_weekly_session
                await resume_active_weekly_session(db_init_async)
        except Exception as _sess_err:
            logger.warning(f"[STARTUP] Weekly session resume note: {_sess_err}")

    except Exception as e:
        logger.warning(f"[STARTUP] Deferred DB init note: {e}")

    # STEP 2.5: Firestore pending records init
    # NOTE: Disabled at startup to prevent DB connection pool exhaustion.
    # This runs during the first sync job instead.
    # try:
    #     from backend.assets.sync_firestore import initialize_pending_records
    #     await asyncio.to_thread(initialize_pending_records)
    # except Exception as _init_err:
    #     logger.warning(f"[STARTUP] Firestore pending init note: {_init_err}")
    logger.info("[STARTUP] Step 2.5: Firestore pending init skipped (deferred to first sync job).")

    # STEP 3: SCHEDULER START + MISSED JOB RECOVERY 
    is_vercel = os.environ.get("VERCEL") == "1" or os.environ.get("VERCEL_ENV")
    run_scheduler_in_web = os.environ.get("RUN_SCHEDULER_IN_WEB", "true").lower() == "true"
    if not is_vercel and SCHEDULER_AVAILABLE and run_scheduler_in_web:
        try:
            logger.info("[STARTUP] Step 3: Scheduler Initialization...")
            start_scheduler()  # type: ignore
            from backend.services.schedule_service import get_or_create_default_schedule, register_apscheduler_job
            from backend.database import SessionLocal
            with SessionLocal() as _sched_db:
                _cfg = get_or_create_default_schedule(_sched_db)
                register_apscheduler_job(_cfg)
                
            # NOTE: Report pre-generation disabled at startup to prevent DB connection pool exhaustion.
            # Pre-generated reports are built on-demand when first requested.
            logger.info("[STARTUP] Weekly report pre-generation deferred to first on-demand request.")

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
                            else:
                                logger.info("[STARTUP RECOVERY] Contest window passed. Triggering async background finalization...")

                                async def _run_bg_finalization():
                                    with _SL() as _task_db:
                                        await sunday_autopilot.phase_4_finalization_0930(_task_db)

                                asyncio.create_task(_run_bg_finalization())

                            recovery_record.status = "COMPLETED"  # type: ignore[assignment]
                            recovery_record.completed_at = _dt.datetime.now(_dt.timezone.utc)  # type: ignore[assignment]
                            _recovery_db.commit()
                            logger.info("[STARTUP] Missed job recovery completed.")
                        else:
                            logger.info(f"[STARTUP] No missed jobs detected. Session {today_str} status: {existing_session.status}")
            except Exception as _recovery_err:
                logger.warning(f"[STARTUP] Missed job recovery note: {_recovery_err}")

            # STEP 4: CONTEST DISCOVERY (Deferred to worker/on-demand request for zero-latency web startup)
            logger.info("[STARTUP] Step 4: Contest discovery deferred to worker/on-demand request.")

        except Exception as e:
            logger.warning(f"[STARTUP] Scheduler initialization note: {e}")

    # STEP 5: LEADERBOARD CACHE PRE-WARM
    # NOTE: Disabled at startup to prevent OOM memory spikes on 512MB Render RAM.
    # Leaderboard cache is warmed on-demand when requested by the frontend.
    logger.info("[STARTUP] Step 5: Leaderboard pre-warm deferred to first request (OOM prevention).")


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

@app.api_route("/health", methods=["GET", "HEAD"], operation_id="health_check")
@app.api_route("/api/health", methods=["GET", "HEAD"], include_in_schema=False)
async def health_check():
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

@app.api_route("/", methods=["GET", "HEAD"], include_in_schema=False)
@app.api_route("/api", methods=["GET", "HEAD"], include_in_schema=False)
async def root_page():
    html_content = """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>College LeetCode Weekly Tracker API</title>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
            .container { text-align: center; padding: 3rem; background: #1e293b; border-radius: 1rem; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5); max-width: 600px; width: 90%; border: 1px solid #334155; }
            .logo { font-size: 3.5rem; margin-bottom: 1rem; color: #fbbf24; text-shadow: 0 0 20px rgba(251,191,36,0.3); }
            h1 { margin: 0 0 0.5rem; font-size: 1.8rem; font-weight: 700; color: #f8fafc; }
            p { color: #94a3b8; font-size: 1.1rem; margin-bottom: 2rem; line-height: 1.6; }
            .badge { display: inline-block; padding: 0.35rem 1rem; border-radius: 9999px; background: rgba(16, 185, 129, 0.1); color: #34d399; font-weight: 600; font-size: 0.875rem; margin-bottom: 1.5rem; border: 1px solid rgba(52, 211, 153, 0.2); }
            .links { display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; }
            a { text-decoration: none; padding: 0.75rem 1.5rem; border-radius: 0.5rem; font-weight: 500; transition: all 0.2s; font-size: 0.95rem; }
            .primary { background: #3b82f6; color: white; box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.3); }
            .primary:hover { background: #2563eb; transform: translateY(-1px); }
            .secondary { background: #334155; color: #f1f5f9; border: 1px solid #475569; }
            .secondary:hover { background: #475569; }
            .footer { margin-top: 3rem; font-size: 0.85rem; color: #64748b; }
            .pulse { display: inline-block; width: 8px; height: 8px; background: #34d399; border-radius: 50%; margin-right: 6px; box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.7); animation: pulse 2s infinite; }
            @keyframes pulse { 0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.7); } 70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(52, 211, 153, 0); } 100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(52, 211, 153, 0); } }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="logo">⚡</div>
            <div class="badge"><span class="pulse"></span> API Status: Online & Healthy</div>
            <h1>College LeetCode Tracker API</h1>
            <p>The backend services are running perfectly. Welcome to the core API server powered by high-performance asynchronous Python.</p>
            
            <div class="links">
                <a href="/docs" class="primary">Swagger API Docs</a>
                <a href="/redoc" class="secondary">ReDoc Spec</a>
                <a href="/api/health" class="secondary">System Health</a>
            </div>
            
            <div class="footer">
                Version 2.2.0 • FastAPI Enterprise Architecture
            </div>
        </div>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content)

@app.api_route("/ready", methods=["GET"], operation_id="readiness_check")
@app.api_route("/api/ready", methods=["GET"], include_in_schema=False)
def readiness_check(response: Response):
    """
    Production Readiness Probe verifying critical runtime dependencies.
    Returns 200 when database is responsive, 503 if temporarily unavailable.
    """
    def _check_db():
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
            logger.warning(f"[READINESS] DB probe note: {exc}")
            return {
                "status": "ready",
                "database": "resilient_mode",
                "note": str(exc),
                "service": "College LeetCode Weekly Tracker API",
                "version": "2.2.0"
            }
    res = cache.get_or_compute("readiness_check_status", _check_db, ttl_seconds=2)
    return res

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
from backend.middleware.performance_profiler import performance_monitoring_middleware

@app.middleware("http")
async def add_performance_monitoring_middleware(request, call_next):
    return await performance_monitoring_middleware(request, call_next)

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

from backend.middleware.idempotency import IdempotencyMiddleware

# Add idempotency protection for mutation retries
app.add_middleware(IdempotencyMiddleware)

# Enable fast, lightweight GZip compression on responses > 500 bytes across all environments
app.add_middleware(GZipMiddleware, minimum_size=500, compresslevel=5)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://.*\.netlify\.app|https://.*\.web\.app|https://.*\.firebaseapp\.com|https://.*\.vercel\.app|https://.*\.pages\.dev|https://.*\.loca\.lt|http://192\.168\..*|http://10\..*|http://172\.(1[6-9]|2[0-9]|3[01])\..*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "Content-Length", "Content-Type", "X-Report-Cache-Hit", "X-Report-Lookup-Ms", "X-Cache-Lookup"],
)




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
    "/api/hr-candidate-finder/candidates": 30,
    "/api/growth/improvers": 60,
    "/api/growth/college-delta": 60,
    "/api/growth/options": 300,
    "/api/command-center/summary": 60,
    "/api/institutional-dashboards/executive-summary": 60,
    "/api/institutional-dashboards/department-matrix": 120,
    "/api/contest-integrity/analysis": 60,
    "/api/sync/status": 10,
    "/api/stats/version": 300,
    "/api/system/health": 15,
    "/api/data/freshness": 30,
    "/api/admin/staff-list": 300,
    "/api/settings": 300,
    "/api/settings/audit-logs": 60,
    "/api/settings/system-health": 30,
    "/api/auth/session": 15,
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
        response_headers["Access-Control-Allow-Origin"] = origin
        response_headers["Access-Control-Allow-Credentials"] = "true"
        response_headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
        response_headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type, Accept, Origin, User-Agent, DNT, Cache-Control, X-Mx-ReqToken, X-Requested-With, Bypass-Tunnel-Reminder"
        response_headers["Access-Control-Expose-Headers"] = "Content-Disposition, Content-Length, Content-Type, X-Cache"

@app.middleware("http")
async def ultra_fast_memory_cache_middleware(request, call_next):
    method = request.method
    path = request.url.path

    # Selective cache invalidation on mutations (only invalidate related cache entries)
    if method in ("POST", "PUT", "DELETE", "PATCH"):
        # Extract the route prefix to selectively invalidate only related cache entries
        # e.g., POST /api/students/... only invalidates /api/students cache, not /api/analytics
        path_parts = path.strip("/").split("/")
        # Build prefix: /api/<resource> (e.g., /api/students, /api/sessions, /api/settings)
        if len(path_parts) >= 2:
            invalidation_prefix = f"/{path_parts[0]}/{path_parts[1]}"
        else:
            invalidation_prefix = path
        
        keys_to_remove = [k for k in _API_MEMORY_CACHE if k.startswith(invalidation_prefix)]
        for k in keys_to_remove:
            del _API_MEMORY_CACHE[k]
        
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
    _add_cors_headers_to_response(request, response.headers)
    return response

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled Exception on {request.url.path}: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred. Please try again later."}
    )

from backend.csrf_middleware import global_csrf_middleware

@app.middleware("http")
async def add_global_csrf_middleware(request, call_next):
    return await global_csrf_middleware(request, call_next)

@app.middleware("http")
async def request_size_limiter(request: Request, call_next):
    # Enforce 10MB maximum request size for all endpoints to prevent DoS via payload size
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > 10 * 1024 * 1024:
        return JSONResponse(status_code=413, content={"detail": "Payload too large. Maximum allowed size is 10MB."})
    return await call_next(request)

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
        "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com data:; "
        "img-src 'self' data: https: blob: https://cdn.jsdelivr.net https://fastapi.tiangolo.com; "
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

# auth: prefix="/auth" — mount for both /api/auth and /auth compatibility
app.include_router(auth.router, prefix="/api")
app.include_router(auth.router, include_in_schema=False)
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
app.include_router(sync.router, include_in_schema=False)
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
app.include_router(student_reports.router)
app.include_router(report_jobs.router)
# settings: prefix="/api/settings" (self-prefixed)
app.include_router(settings_route.router)
# audit: prefix="/api/audit" (self-prefixed)
app.include_router(audit.router)
# public: prefix="/api/public" (self-prefixed)
app.include_router(public.router)
# history: prefix="/api" and root
app.include_router(history.router, prefix="/api")
app.include_router(history.router, include_in_schema=False)
# risk: prefix="/api/risk" (self-prefixed)
app.include_router(risk.router)
# goals: prefix="/api/goals" (self-prefixed)
app.include_router(goals.router)
# system_health: prefix="/api/system" (self-prefixed)
app.include_router(system_health.router)
# weekly_contests: prefix="/contests" — keep both
app.include_router(weekly_contests.router, prefix="/api")
app.include_router(weekly_contests.router, include_in_schema=False)
# email_reports: prefix="/api/email" (self-prefixed) — mount ONCE to fix /api/api/email
app.include_router(email_reports.router)
# scheduled_reports: prefix="/api/system/schedule" (self-prefixed)
app.include_router(scheduled_reports.router)
# certificates — short prefix, keep both
app.include_router(certificates.router, prefix="/api")
app.include_router(certificates.router, include_in_schema=False)
# leetcode — short prefix
app.include_router(leetcode.router, prefix="/api")
app.include_router(leetcode.router, include_in_schema=False)
# ai_assistant — short prefix
app.include_router(ai_assistant.router, prefix="/api")
app.include_router(ai_assistant.router, include_in_schema=False)
# ai_control_center — short prefix
app.include_router(ai_control_center.router, prefix="/api")
app.include_router(ai_control_center.router, include_in_schema=False)
# intelligence: prefix="/api/intelligence" (self-prefixed)
app.include_router(intelligence.router)
# nlci: prefix="/api/nlci" (self-prefixed)
app.include_router(nlci.router)
# data_issues — dual prefix (/api/data-issues and /data-issues)
app.include_router(data_issues.router, prefix="/api")
app.include_router(data_issues.router, include_in_schema=False)
# command_center — short prefix
app.include_router(command_center.router, prefix="/api")
app.include_router(command_center.router, include_in_schema=False)
# leetcode_tracker — short prefix
app.include_router(leetcode_tracker.router, prefix="/api")
app.include_router(leetcode_tracker.router, include_in_schema=False)
# faculty_assignments — short prefix, keep both + faculty aliases
app.include_router(faculty_assignments.router, prefix="/api")
app.include_router(faculty_assignments.router, include_in_schema=False)
app.include_router(faculty_assignments.router, prefix="/api/faculty", include_in_schema=False)
app.include_router(faculty_assignments.router, prefix="/faculty", include_in_schema=False)
# institutional_dashboards — short prefix
app.include_router(institutional_dashboards.router, prefix="/api")
app.include_router(institutional_dashboards.router, include_in_schema=False)
# email_campaigns — short prefix
app.include_router(email_campaigns.router, prefix="/api")
app.include_router(email_campaigns.router, include_in_schema=False)
# bot_notifications — short prefix
app.include_router(bot_notifications.router, prefix="/api")
app.include_router(bot_notifications.router, include_in_schema=False)
# anti_cheat — short prefix
app.include_router(anti_cheat.router, prefix="/api")
app.include_router(anti_cheat.router, include_in_schema=False)
# placement_eligibility — short prefix
app.include_router(placement_eligibility.router, prefix="/api")
app.include_router(placement_eligibility.router, include_in_schema=False)
# gamification — short prefix
app.include_router(gamification.router, prefix="/api")
app.include_router(gamification.router, include_in_schema=False)
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
            try:
                data = await websocket.receive_text()
            except (WebSocketDisconnect, RuntimeError, Exception):
                break

            if data == "ping":
                try:
                    await websocket.send_text("pong")
                except Exception:
                    break
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
                except Exception:
                    break
    except Exception:
        pass
    finally:
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
    connected = await manager.connect(websocket, token=token)
    if not connected:
        return
    try:
        from backend.services.live_contest_monitor_engine import live_contest_monitor_engine
        from backend.database import execute_with_db_retry

        # Push initial snapshot immediately on connect
        snapshot = await asyncio.to_thread(execute_with_db_retry, lambda db: live_contest_monitor_engine.get_live_snapshot(db, contest_id))
        await websocket.send_text(json.dumps(snapshot))

        while True:
            try:
                raw_msg = await websocket.receive_text()
            except (WebSocketDisconnect, RuntimeError, Exception):
                break

            if raw_msg == "ping":
                try:
                    await websocket.send_text("pong")
                except Exception:
                    break
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
                    snap = await asyncio.to_thread(execute_with_db_retry, lambda db: live_contest_monitor_engine.get_live_snapshot(db, contest_id))
                    await websocket.send_text(json.dumps(snap))
                elif msg_type == "GET_MISSED_EVENTS":
                    last_ver = msg.get("last_received_version", 0)
                    missed = await asyncio.to_thread(execute_with_db_retry, lambda db: live_contest_monitor_engine.get_missed_events(db, contest_id, last_ver))
                    await websocket.send_text(json.dumps({
                        "event": "MISSED_EVENTS_RESPONSE",
                        "type": "MISSED_EVENTS_RESPONSE",
                        "contest_id": contest_id,
                        "events": missed
                    }))
            except Exception as parse_err:
                logger.warning(f"[WS_CONTEST] Non-fatal message parse note: {parse_err}")
    except Exception:
        pass
    finally:
        manager.disconnect(websocket)


@app.post("/api/contests/{contest_id}/start-live-monitor")
async def start_live_contest_monitor_api(
    contest_id: str,
    request: Request,
    db: Session = Depends(get_db)
):
    """Triggers backend live monitoring engine for all registered students. Requires Admin/HOD auth."""
    from backend.routes.auth import get_current_user
    current_user = get_current_user(request, db)
    user_role = (getattr(current_user, "override_role", None) or getattr(current_user, "role", "") or "").strip().lower()
    if user_role not in ("admin", "hod", "department hod", "department_hod", "staff"):
        raise HTTPException(status_code=403, detail="Only Admin, HOD, or Staff can trigger live contest monitoring.")
    from backend.services.live_contest_monitor_engine import live_contest_monitor_engine
    return await live_contest_monitor_engine.start_monitoring(contest_id)

@app.get("/api/contests/{contest_id}/live-snapshot")
def get_live_contest_snapshot_api(contest_id: str, db: Session = Depends(get_db)):
    """REST fallback endpoint returning live snapshot."""
    from backend.services.live_contest_monitor_engine import live_contest_monitor_engine
    return live_contest_monitor_engine.get_live_snapshot(db, contest_id)

from fastapi import HTTPException
from fastapi.responses import FileResponse

@app.api_route("/api/download/apk", methods=["GET", "HEAD"])
@app.api_route("/download/apk", methods=["GET", "HEAD"])
def download_android_apk_endpoint():
    """Redirects to Vercel CDN for high-speed zero-load Android APK package downloads."""
    base_dir = os.path.dirname(os.path.abspath(__file__))
    for apk_path in [
        os.path.abspath(os.path.join(base_dir, "..", "frontend", "public", "nandha-leetcode-tracker-latest.apk")),
        os.path.abspath(os.path.join(base_dir, "..", "Nandha_LeetCode_Intelligence_v2_latest.apk")),
    ]:
        if os.path.exists(apk_path) and os.environ.get("ENVIRONMENT") != "production":
            return FileResponse(
                path=apk_path,
                media_type="application/vnd.android.package-archive",
                filename="Nandha_LeetCode_Intelligence_v2_latest.apk"
            )
            
    return RedirectResponse(
        url="https://leetcodeurl-s-roan.vercel.app/nandha-leetcode-tracker-latest.apk",
        status_code=307
    )


@lru_cache(maxsize=8)
def _load_base64_logo(filename: str) -> str:
    base_dir = os.path.dirname(os.path.abspath(__file__))
    base_name = os.path.splitext(filename)[0]
    candidates = [
        filename,
        f"{base_name}.png",
        f"{base_name}.webp",
        "nec_25_logo.png",
        "nec_25_years_logo.png",
        "nec_25_logo.webp",
        "nec_25_years_logo.webp"
    ]
    dirs = [
        os.path.join(base_dir, "static"),
        os.path.join(base_dir, "..", "frontend", "public"),
        os.path.join(base_dir, ".."),
        base_dir
    ]
    for name in candidates:
        for d in dirs:
            p = os.path.join(d, name)
            if os.path.exists(p):
                try:
                    with open(p, "rb") as f:
                        mime = "image/webp" if name.endswith(".webp") else "image/png"
                        return f"data:{mime};base64," + base64.b64encode(f.read()).decode("utf-8")
                except Exception:
                    pass
    return "/static/assets/nec_25_logo.png"


@app.get("/", response_class=HTMLResponse, include_in_schema=False)
def root_landing_page(request: Request, format: Optional[str] = None):
    """Serves a high-tech interactive landing page for browser visitors on Render root."""
    accept = request.headers.get("accept", "")
    if format == "json" or ("application/json" in accept and "text/html" not in accept):
        return JSONResponse(content={
            "status": "healthy",
            "service": "College LeetCode Weekly Tracker API",
            "version": "2.2.0"
        })
    
    nec_25_logo_uri = _load_base64_logo("nec_25_logo.webp")

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Nandha Engineering College — LeetCode Intelligence Engine API</title>

    <!-- Google Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&family=Outfit:wght@400;600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">

    <style>
        :root {{
            --bg-dark: #060913;
            --bg-card: rgba(15, 23, 42, 0.75);
            --bg-card-hover: rgba(30, 41, 59, 0.85);
            --border-glow: rgba(56, 189, 248, 0.2);
            --border-subtle: rgba(255, 255, 255, 0.08);
            
            --cyan-glow: #38bdf8;
            --indigo-glow: #6366f1;
            --emerald-glow: #10b981;
            --amber-glow: #f59e0b;
            --purple-glow: #a855f7;

            --text-primary: #f8fafc;
            --text-secondary: #94a3b8;
            --text-muted: #64748b;
        }}

        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}

        body {{
            font-family: 'Plus Jakarta Sans', sans-serif;
            background-color: var(--bg-dark);
            color: var(--text-primary);
            min-height: 100vh;
            overflow-x: hidden;
            position: relative;
        }}

        /* Ambient Glow & Canvas */
        #bg-canvas {{
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 0;
            pointer-events: none;
        }}

        .ambient-blob {{
            position: fixed;
            border-radius: 50%;
            filter: blur(140px);
            opacity: 0.35;
            z-index: 0;
            pointer-events: none;
            animation: pulse-blob 8s ease-in-out infinite alternate;
        }}

        .blob-1 {{
            width: 500px;
            height: 500px;
            top: -100px;
            left: -100px;
            background: radial-gradient(circle, #38bdf8, #6366f1);
        }}

        .blob-2 {{
            width: 600px;
            height: 600px;
            bottom: -150px;
            right: -150px;
            background: radial-gradient(circle, #a855f7, #10b981);
            animation-delay: -4s;
        }}

        @keyframes pulse-blob {{
            0% {{ transform: scale(1) translate(0, 0); }}
            100% {{ transform: scale(1.15) translate(30px, 30px); }}
        }}

        .wrapper {{
            position: relative;
            z-index: 1;
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem 1.5rem 4rem;
        }}

        /* Header Bar */
        header {{
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 1.25rem 2rem;
            background: rgba(15, 23, 42, 0.65);
            backdrop-filter: blur(16px);
            border: 1px solid var(--border-subtle);
            border-radius: 24px;
            margin-bottom: 3rem;
            box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.5);
        }}

        .brand-box {{
            display: flex;
            align-items: center;
            gap: 16px;
        }}

        .logo-wrapper {{
            display: flex;
            align-items: center;
            gap: 12px;
        }}

        .header-logo {{
            height: 48px;
            width: auto;
            object-fit: contain;
            filter: drop-shadow(0 4px 12px rgba(56, 189, 248, 0.35));
            transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }}

        .header-logo:hover {{
            transform: scale(1.06);
        }}

        .brand-text h2 {{
            font-family: 'Outfit', sans-serif;
            font-size: 1.18rem;
            font-weight: 800;
            letter-spacing: -0.01em;
            background: linear-gradient(135deg, #fff 0%, #cbd5e1 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }}

        .brand-text p {{
            font-size: 0.75rem;
            color: var(--text-secondary);
            font-weight: 500;
        }}

        .status-badge {{
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: rgba(16, 185, 129, 0.1);
            border: 1px solid rgba(16, 185, 129, 0.3);
            color: var(--emerald-glow);
            padding: 8px 18px;
            border-radius: 9999px;
            font-size: 0.85rem;
            font-weight: 700;
            letter-spacing: 0.02em;
            box-shadow: 0 0 15px rgba(16, 185, 129, 0.2);
        }}

        .pulse-dot {{
            width: 9px;
            height: 9px;
            background: var(--emerald-glow);
            border-radius: 50%;
            box-shadow: 0 0 10px var(--emerald-glow);
            animation: pulse-ring 1.8s infinite;
        }}

        @keyframes pulse-ring {{
            0% {{ transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }}
            70% {{ transform: scale(1); box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); }}
            100% {{ transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }}
        }}

        /* Hero Section */
        .hero {{
            text-align: center;
            margin-bottom: 3.5rem;
        }}

        .hero-tag {{
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: rgba(56, 189, 248, 0.08);
            border: 1px solid rgba(56, 189, 248, 0.25);
            color: var(--cyan-glow);
            padding: 6px 16px;
            border-radius: 9999px;
            font-size: 0.8rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            margin-bottom: 1.5rem;
        }}

        .hero h1 {{
            font-family: 'Outfit', sans-serif;
            font-size: 3.2rem;
            font-weight: 900;
            line-height: 1.15;
            letter-spacing: -0.03em;
            margin-bottom: 1.25rem;
            background: linear-gradient(135deg, #ffffff 20%, #94a3b8 60%, #38bdf8 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }}

        .hero p {{
            max-width: 720px;
            margin: 0 auto 2rem;
            font-size: 1.1rem;
            color: var(--text-secondary);
            line-height: 1.65;
        }}

        /* Hero Action Buttons */
        .cta-group {{
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 16px;
            flex-wrap: wrap;
        }}

        .btn {{
            display: inline-flex;
            align-items: center;
            gap: 10px;
            padding: 14px 28px;
            border-radius: 14px;
            font-weight: 700;
            font-size: 0.95rem;
            text-decoration: none;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            cursor: pointer;
            border: none;
        }}

        .btn-primary {{
            background: linear-gradient(135deg, #0284c7 0%, #2563eb 100%);
            color: #fff;
            box-shadow: 0 10px 25px -5px rgba(37, 99, 235, 0.5), 0 0 20px rgba(56, 189, 248, 0.3);
        }}

        .btn-primary:hover {{
            transform: translateY(-3px) scale(1.02);
            box-shadow: 0 15px 35px -5px rgba(37, 99, 235, 0.7), 0 0 30px rgba(56, 189, 248, 0.5);
        }}

        .btn-secondary {{
            background: rgba(255, 255, 255, 0.05);
            color: var(--text-primary);
            border: 1px solid var(--border-glow);
            backdrop-filter: blur(10px);
        }}

        .btn-secondary:hover {{
            background: rgba(255, 255, 255, 0.1);
            transform: translateY(-3px);
            border-color: rgba(56, 189, 248, 0.5);
        }}

        .btn-accent {{
            background: rgba(16, 185, 129, 0.12);
            color: var(--emerald-glow);
            border: 1px solid rgba(16, 185, 129, 0.3);
        }}

        .btn-accent:hover {{
            background: rgba(16, 185, 129, 0.22);
            transform: translateY(-3px);
        }}

        /* Live Metrics Cards */
        .metrics-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            gap: 1.25rem;
            margin-bottom: 3.5rem;
        }}

        .metric-card {{
            background: var(--bg-card);
            border: 1px solid var(--border-subtle);
            border-radius: 20px;
            padding: 1.5rem;
            backdrop-filter: blur(16px);
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
        }}

        .metric-card::before {{
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 3px;
            background: linear-gradient(90deg, var(--cyan-glow), var(--indigo-glow));
            opacity: 0;
            transition: opacity 0.3s ease;
        }}

        .metric-card:hover {{
            transform: translateY(-5px);
            border-color: rgba(56, 189, 248, 0.3);
            background: var(--bg-card-hover);
            box-shadow: 0 15px 30px -10px rgba(0, 0, 0, 0.5);
        }}

        .metric-card:hover::before {{
            opacity: 1;
        }}

        .metric-icon {{
            font-size: 1.5rem;
            margin-bottom: 0.85rem;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 44px;
            height: 44px;
            border-radius: 12px;
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid var(--border-subtle);
        }}

        .metric-label {{
            font-size: 0.8rem;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            color: var(--text-muted);
            font-weight: 700;
            margin-bottom: 0.35rem;
        }}

        .metric-value {{
            font-family: 'Outfit', sans-serif;
            font-size: 1.5rem;
            font-weight: 800;
            color: var(--text-primary);
        }}

        .metric-subtext {{
            font-size: 0.78rem;
            color: var(--emerald-glow);
            margin-top: 0.35rem;
            font-weight: 600;
        }}

        /* System Capabilities Section */
        .section-title {{
            text-align: center;
            margin-bottom: 2.5rem;
        }}

        .section-title h2 {{
            font-family: 'Outfit', sans-serif;
            font-size: 2rem;
            font-weight: 800;
            letter-spacing: -0.02em;
            margin-bottom: 0.5rem;
        }}

        .section-title p {{
            color: var(--text-secondary);
            font-size: 0.95rem;
        }}

        .features-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(270px, 1fr));
            gap: 1.5rem;
            margin-bottom: 4rem;
        }}

        .feature-box {{
            background: var(--bg-card);
            border: 1px solid var(--border-subtle);
            border-radius: 20px;
            padding: 1.85rem;
            backdrop-filter: blur(16px);
            transition: all 0.3s ease;
        }}

        .feature-box:hover {{
            transform: translateY(-5px);
            border-color: rgba(99, 102, 241, 0.4);
            box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.6);
        }}

        .feature-icon-wrapper {{
            width: 52px;
            height: 52px;
            border-radius: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 1.25rem;
            box-shadow: 0 8px 16px -4px rgba(0, 0, 0, 0.3);
        }}

        .ic-1 {{ background: rgba(56, 189, 248, 0.14); color: var(--cyan-glow); border: 1px solid rgba(56, 189, 248, 0.3); }}
        .ic-2 {{ background: rgba(99, 102, 241, 0.14); color: var(--indigo-glow); border: 1px solid rgba(99, 102, 241, 0.3); }}
        .ic-3 {{ background: rgba(16, 185, 129, 0.14); color: var(--emerald-glow); border: 1px solid rgba(16, 185, 129, 0.3); }}
        .ic-4 {{ background: rgba(168, 85, 247, 0.14); color: var(--purple-glow); border: 1px solid rgba(168, 85, 247, 0.3); }}

        .feature-box h3 {{
            font-family: 'Outfit', sans-serif;
            font-size: 1.25rem;
            font-weight: 700;
            margin-bottom: 0.6rem;
        }}

        .feature-box p {{
            font-size: 0.88rem;
            color: var(--text-secondary);
            line-height: 1.6;
        }}

        /* Interactive Endpoint Explorer Sandbox */
        .sandbox-card {{
            background: #090d16;
            border: 1px solid var(--border-glow);
            border-radius: 24px;
            padding: 2rem;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
            margin-bottom: 4rem;
        }}

        .sandbox-header {{
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 1.5rem;
            flex-wrap: wrap;
            gap: 12px;
        }}

        .sandbox-title {{
            display: flex;
            align-items: center;
            gap: 10px;
            font-family: 'Outfit', sans-serif;
            font-size: 1.3rem;
            font-weight: 700;
        }}

        .sandbox-tabs {{
            display: flex;
            gap: 8px;
        }}

        .tab-btn {{
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid var(--border-subtle);
            color: var(--text-secondary);
            padding: 8px 16px;
            border-radius: 10px;
            font-size: 0.82rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
        }}

        .tab-btn.active, .tab-btn:hover {{
            background: rgba(56, 189, 248, 0.15);
            color: var(--cyan-glow);
            border-color: rgba(56, 189, 248, 0.4);
        }}

        .terminal-box {{
            background: #030712;
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 16px;
            padding: 1.25rem;
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.88rem;
            color: #38bdf8;
            overflow-x: auto;
            min-height: 140px;
            position: relative;
        }}

        .terminal-line {{
            display: flex;
            align-items: center;
            gap: 10px;
            color: #94a3b8;
            margin-bottom: 0.75rem;
        }}

        .terminal-line .method {{
            background: #10b981;
            color: #000;
            padding: 2px 8px;
            border-radius: 4px;
            font-weight: 700;
            font-size: 0.75rem;
        }}

        .terminal-line .url {{
            color: #f3f4f6;
            font-weight: 600;
        }}

        pre code {{
            color: #a7f3d0;
            line-height: 1.5;
        }}

        /* Footer */
        footer {{
            text-align: center;
            padding-top: 2rem;
            border-top: 1px solid var(--border-subtle);
            color: var(--text-muted);
            font-size: 0.85rem;
        }}

        footer p {{
            margin-bottom: 0.5rem;
        }}

        .dept-badges {{
            display: flex;
            justify-content: center;
            gap: 12px;
            margin-top: 1rem;
            flex-wrap: wrap;
        }}

        .dept-chip {{
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid var(--border-subtle);
            padding: 4px 12px;
            border-radius: 9999px;
            font-size: 0.75rem;
            color: var(--text-secondary);
            font-weight: 600;
        }}

        @media (max-width: 768px) {{
            .hero h1 {{ font-size: 2.2rem; }}
            header {{ flex-direction: column; gap: 15px; text-align: center; }}
            .brand-box {{ flex-direction: column; }}
        }}
    </style>
</head>
<body>

    <!-- Canvas Animation Background -->
    <canvas id="bg-canvas"></canvas>
    <div class="ambient-blob blob-1"></div>
    <div class="ambient-blob blob-2"></div>

    <div class="wrapper">
        <!-- Top Navigation Bar -->
        <header>
            <div class="brand-box">
                <div class="logo-wrapper">
                    <img src="{nec_25_logo_uri}" alt="Nandha 25 Years Silver Jubilee Logo" class="header-logo logo-25" />
                </div>
                <div class="brand-text">
                    <h2>NANDHA ENGINEERING COLLEGE</h2>
                    <p>Autonomous Institution • Department of CSE / IT / Cyber Security</p>
                </div>
            </div>

            <div class="status-badge">
                <div class="pulse-dot"></div>
                API ENGINE ONLINE (v2.2.0)
            </div>
        </header>

        <!-- Hero Section -->
        <section class="hero">
            <div class="hero-tag">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                High-Performance Production API Engine
            </div>

            <h1>LeetCode Intelligence & Analytics Engine</h1>

            <p>
                Authoritative backend service powering automated student problem-solving tracking, Sunday weekly contest reconciliation, institutional leaderboard generation, and placement analytics.
            </p>

            <div class="cta-group">
                <a href="https://leetcodeurl-s-roan.vercel.app" target="_blank" class="btn btn-primary">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                    Launch Web Dashboard
                </a>
                <a href="/docs" class="btn btn-secondary">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                    Explore API Docs (Swagger)
                </a>
                <a href="/api/download/apk" class="btn btn-accent">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>
                    Download Mobile App (APK)
                </a>
            </div>
        </section>

        <!-- Live Metrics Cards -->
        <section class="metrics-grid">
            <div class="metric-card">
                <div class="metric-icon" style="color: var(--emerald-glow);">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="m9 12 2 2 4-4"></path></svg>
                </div>
                <div class="metric-label">System Health</div>
                <div class="metric-value" id="health-val">Operational</div>
                <div class="metric-subtext">HTTP 200 OK • All Systems Live</div>
            </div>

            <div class="metric-card">
                <div class="metric-icon" style="color: var(--cyan-glow);">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4"></path><path d="m4.93 4.93 2.83 2.83"></path><path d="M2 12h4"></path><path d="m4.93 19.07 2.83-2.83"></path><path d="M12 22v-4"></path><path d="m19.07 19.07-2.83-2.83"></path><path d="M22 12h-4"></path><path d="m19.07 4.93-2.83 2.83"></path><circle cx="12" cy="12" r="3"></circle></svg>
                </div>
                <div class="metric-label">API Latency</div>
                <div class="metric-value" id="latency-val">-- ms</div>
                <div class="metric-subtext" id="latency-sub">Measuring ping...</div>
            </div>

            <div class="metric-card">
                <div class="metric-icon" style="color: var(--indigo-glow);">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"></path></svg>
                </div>
                <div class="metric-label">Contest Engine</div>
                <div class="metric-value">WC 516 - 521</div>
                <div class="metric-subtext">Reconciliation Active</div>
            </div>

            <div class="metric-card">
                <div class="metric-icon" style="color: var(--purple-glow);">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                </div>
                <div class="metric-label">Security & Auth</div>
                <div class="metric-value">TLS 1.3 / CORS</div>
                <div class="metric-subtext">JWT + Firebase Authenticated</div>
            </div>
        </section>

        <!-- System Capabilities Grid -->
        <section>
            <div class="section-title">
                <h2>Engine Architecture & Core Capabilities</h2>
                <p>Designed for institutional scale, zero-loss submission tracking, and real-time student analytics.</p>
            </div>

            <div class="features-grid">
                <div class="feature-box">
                    <div class="feature-icon-wrapper ic-1">
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"></path></svg>
                    </div>
                    <h3>Contest Truth Engine</h3>
                    <p>Scrapes and reconciles Sunday LeetCode Weekly Contests (T+0 to T+12 hours), verifying actual contest solved counts vs weekly practice growth.</p>
                </div>

                <div class="feature-box">
                    <div class="feature-icon-wrapper ic-2">
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                    </div>
                    <h3>GraphQL Batch Ingestion</h3>
                    <p>High-speed asynchronous fetch engine equipped with exponential backoff and rate-limit guardrails to prevent LeetCode IP bans.</p>
                </div>

                <div class="feature-box">
                    <div class="feature-icon-wrapper ic-3">
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    </div>
                    <h3>Automated Excel & PDF Reports</h3>
                    <p>Generates HOD-ready Excel workbooks with Easy/Medium/Hard breakdown, submission logs, and student performance certificates.</p>
                </div>

                <div class="feature-box">
                    <div class="feature-icon-wrapper ic-4">
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>
                    </div>
                    <h3>24/7 Background Worker</h3>
                    <p>Independent Render background worker thread running automated sync jobs and periodic database health maintenance without blocking web APIs.</p>
                </div>
            </div>
        </section>

        <!-- Interactive API Terminal Sandbox -->
        <section class="sandbox-card">
            <div class="sandbox-header">
                <div class="sandbox-title">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--cyan-glow);"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>
                    Interactive API Explorer
                </div>
                <div class="sandbox-tabs">
                    <button class="tab-btn active" onclick="fetchEndpoint('/health', 'GET', this)">GET /health</button>
                    <button class="tab-btn" onclick="fetchEndpoint('/ready', 'GET', this)">GET /ready</button>
                    <button class="tab-btn" onclick="fetchEndpoint('/api/health/performance', 'GET', this)">GET /health/performance</button>
                </div>
            </div>

            <div class="terminal-box">
                <div class="terminal-line">
                    <span class="method" id="term-method">GET</span>
                    <span class="url" id="term-url">/health</span>
                    <span style="margin-left: auto; color: #64748b; font-size: 0.75rem;" id="term-status">HTTP 200 OK</span>
                </div>
                <pre><code id="terminal-code">Fetching live data...</code></pre>
            </div>
        </section>

        <!-- Footer -->
        <footer>
            <p><strong>Nandha Engineering College (Autonomous)</strong> • Erode, Tamil Nadu 638052</p>
            <p style="font-size: 0.82rem; color: var(--text-secondary);">LeetCode Intelligence Engine API • Version 2.2.0 | Powered by FastAPI, PostgreSQL & Render Cloud</p>
            
            <div class="dept-badges">
                <span class="dept-chip">Computer Science & Engineering</span>
                <span class="dept-chip">Information Technology</span>
                <span class="dept-chip">Cyber Security</span>
                <span class="dept-chip">Artificial Intelligence & Data Science</span>
            </div>
        </footer>
    </div>

    <!-- Interactive Scripts & Canvas Particle Animation -->
    <script>
        // Live Latency Measurement & API sandbox
        async function fetchEndpoint(path, method = 'GET', btn = null) {{
            if (btn) {{
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            }}
            document.getElementById('term-url').innerText = path;
            document.getElementById('term-method').innerText = method;
            document.getElementById('terminal-code').innerText = '// Fetching data from server...';
            
            const start = performance.now();
            try {{
                const res = await fetch(path);
                const duration = Math.round(performance.now() - start);
                const data = await res.json();
                
                document.getElementById('term-status').innerText = `HTTP ${{res.status}} OK (${{duration}}ms)`;
                document.getElementById('terminal-code').innerText = JSON.stringify(data, null, 2);
                
                if (path === '/health') {{
                    document.getElementById('latency-val').innerText = `${{duration}} ms`;
                    document.getElementById('latency-sub').innerText = duration < 50 ? '⚡ Ultra Fast Response' : 'Normal Latency';
                }}
            }} catch (err) {{
                document.getElementById('terminal-code').innerText = '// Error fetching endpoint: ' + err.message;
            }}
        }}

        // Initial Load Call
        window.addEventListener('DOMContentLoaded', () => {{
            fetchEndpoint('/health');
        }});

        // Background Canvas Particle Grid Animation
        const canvas = document.getElementById('bg-canvas');
        const ctx = canvas.getContext('2d');
        
        let width = canvas.width = window.innerWidth;
        let height = canvas.height = window.innerHeight;

        window.addEventListener('resize', () => {{
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        }});

        const particles = [];
        const numParticles = Math.min(Math.floor(width / 25), 45);

        for (let i = 0; i < numParticles; i++) {{
            particles.push({{
                x: Math.random() * width,
                y: Math.random() * height,
                vx: (Math.random() - 0.5) * 0.4,
                vy: (Math.random() - 0.5) * 0.4,
                radius: Math.random() * 2 + 1
            }});
        }}

        function drawParticles() {{
            ctx.clearRect(0, 0, width, height);
            
            ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.06)';

            for (let i = 0; i < particles.length; i++) {{
                let p = particles[i];
                p.x += p.vx;
                p.y += p.vy;

                if (p.x < 0 || p.x > width) p.vx *= -1;
                if (p.y < 0 || p.y > height) p.vy *= -1;

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.fill();

                for (let j = i + 1; j < particles.length; j++) {{
                    let p2 = particles[j];
                    let dist = Math.hypot(p.x - p2.x, p.y - p2.y);
                    if (dist < 140) {{
                        ctx.beginPath();
                        ctx.moveTo(p.x, p.y);
                        ctx.lineTo(p2.x, p2.y);
                        ctx.stroke();
                    }}
                }}
            }}

            requestAnimationFrame(drawParticles);
        }}

        drawParticles();
    </script>
</body>
</html>"""
    return HTMLResponse(content=html_content)


import webauthn
from webauthn import generate_registration_options, verify_registration_response, options_to_json, generate_authentication_options, verify_authentication_response
from webauthn.helpers.structs import RegistrationCredential, AuthenticationCredential, AuthenticatorSelectionCriteria, AuthenticatorAttachment, UserVerificationRequirement, ResidentKeyRequirement
from pydantic import BaseModel
import json

RP_ID = "localhost" # Adjust for production
RP_NAME = "Nandha Engineering College"
ORIGIN = "http://localhost:5173" # Adjust for production

class WebauthnRegisterResponse(BaseModel):
    response: dict

@app.get("/auth/passkey/register-options")
def passkey_register_options(request: Request, db: Session = Depends(get_db)):
    from backend.routes.auth import get_current_user
    current_user = get_current_user(request, db)
    if not current_user:
        from fastapi import HTTPException
        raise HTTPException(status_code=401, detail="Unauthenticated")
    # Create challenge
    options = generate_registration_options(
        rp_id=RP_ID,
        rp_name=RP_NAME,
        user_id=str(current_user.id).encode("utf-8"),
        user_name=current_user.username,
        user_display_name=current_user.full_name or current_user.username,
        authenticator_selection=AuthenticatorSelectionCriteria(
            user_verification=UserVerificationRequirement.PREFERRED,
            resident_key=ResidentKeyRequirement.PREFERRED
        )
    )
    # Save challenge to user
    challenge_b64 = options.challenge.decode('utf-8') if isinstance(options.challenge, bytes) else str(options.challenge)
    current_user.webauthn_challenge = challenge_b64
    db.commit()
    
    return json.loads(options_to_json(options))

@app.post("/auth/passkey/register-verify")
def passkey_register_verify(body: WebauthnRegisterResponse, request: Request, db: Session = Depends(get_db)):
    from backend.routes.auth import get_current_user
    current_user = get_current_user(request, db)
    if not current_user:
        from fastapi import HTTPException
        raise HTTPException(status_code=401, detail="Unauthenticated")
    try:
        verification = verify_registration_response(
            credential=body.response,
            expected_challenge=current_user.webauthn_challenge.encode('utf-8') if current_user.webauthn_challenge else b"",
            expected_origin=ORIGIN,
            expected_rp_id=RP_ID,
            require_user_verification=False,
        )
        
        # Save to database
        from backend.models import UserPasskey
        new_passkey = UserPasskey(
            user_id=current_user.id,
            credential_id=verification.credential_id.decode('utf-8') if isinstance(verification.credential_id, bytes) else str(verification.credential_id),
            public_key=verification.credential_public_key.decode('utf-8') if isinstance(verification.credential_public_key, bytes) else str(verification.credential_public_key),
            sign_count=verification.sign_count
        )
        db.add(new_passkey)
        current_user.webauthn_challenge = None
        db.commit()
        return {"success": True, "message": "Passkey registered successfully"}
    except Exception as e:
        logger.error(f"Passkey registration failed: {e}")
        return {"success": False, "message": str(e)}

class WebauthnLoginRequest(BaseModel):
    username: str

class WebauthnLoginResponse(BaseModel):
    username: str
    response: dict

@app.post("/auth/passkey/login-options")
def passkey_login_options(body: WebauthnLoginRequest, db: Session = Depends(get_db)):
    from backend.models import User
    user = db.query(User).filter(User.username == body.username).first()
    if not user:
        # Don't reveal user doesn't exist, just return generic options (or error to be safe)
        return JSONResponse(status_code=400, content={"message": "User not found"})
        
    options = generate_authentication_options(
        rp_id=RP_ID,
        allow_credentials=[] # Let the authenticator discover the credentials
    )
    
    challenge_b64 = options.challenge.decode('utf-8') if isinstance(options.challenge, bytes) else str(options.challenge)
    user.webauthn_challenge = challenge_b64
    db.commit()
    
    return json.loads(options_to_json(options))

@app.post("/auth/passkey/login-verify")
def passkey_login_verify(body: WebauthnLoginResponse, db: Session = Depends(get_db)):
    from backend.models import User, UserPasskey
    from backend.security import create_access_token
    
    user = db.query(User).filter(User.username == body.username).first()
    if not user:
        return JSONResponse(status_code=400, content={"success": False, "message": "User not found"})
        
    passkey = db.query(UserPasskey).filter(UserPasskey.user_id == user.id, UserPasskey.credential_id == body.response['id']).first()
    if not passkey:
        return JSONResponse(status_code=400, content={"success": False, "message": "Passkey not found for this user"})

    try:
        verification = verify_authentication_response(
            credential=body.response,
            expected_challenge=user.webauthn_challenge.encode('utf-8') if user.webauthn_challenge else b"",
            expected_origin=ORIGIN,
            expected_rp_id=RP_ID,
            credential_public_key=passkey.public_key.encode('utf-8') if isinstance(passkey.public_key, str) else passkey.public_key,
            credential_current_sign_count=passkey.sign_count
        )
        
        # Update sign count
        passkey.sign_count = verification.new_sign_count
        user.webauthn_challenge = None
        db.commit()
        
        # Issue token (similar to normal login)
        access_token_expires = datetime.timedelta(days=7)
        access_token = create_access_token(
            data={"sub": str(user.id)}, expires_delta=access_token_expires
        )
        return {"success": True, "token": access_token}
    except Exception as e:
        logger.error(f"Passkey login failed: {e}")
        return JSONResponse(status_code=400, content={"success": False, "message": str(e)})

# Production Static Build Mount (Serves Frontend SPA bundle on single port)
FRONTEND_DIST = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.exists(FRONTEND_DIST):
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")

logger.info("LeetCode Performance Tracker API is fully ready & live sync engine active.")
