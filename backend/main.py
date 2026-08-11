import os
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
    audit, public
)

app = FastAPI(
    title="College LeetCode Weekly Tracker API",
    description="Backend API for LeetCode weekly tracking, analytics, leaderboards, Excel/PDF reporting and notifications.",
    version="2.0.0"
)

# CORS Configuration
origins = ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routers
app.include_router(auth.router)
app.include_router(students.router)
app.include_router(departments.router)
app.include_router(sessions.router)
app.include_router(leaderboard.router)
app.include_router(analytics.router)
app.include_router(reports.router)
app.include_router(settings_route.router)
app.include_router(audit.router)
app.include_router(public.router)

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

@app.on_event("startup")
def on_startup():
    logger.info("Initializing database & tables...")
    try:
        seed_database()
    except Exception as e:
        logger.warning(f"Database seed skipped or noted: {e}")
        
    if not is_vercel and SCHEDULER_AVAILABLE:
        logger.info("Starting background scheduler...")
        try:
            start_scheduler()
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

