import asyncio
import os
import sys
import datetime

# Ensure backend module can be imported
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.logger import logger
from backend.scheduler import start_scheduler
from backend.database import SessionLocal, run_migrations
from backend.migrate_db import run_db_migrations
from backend.models import AdminSettingsModel

async def heartbeat_loop():
    """Write heartbeat to DB and ping web API every 4min to keep Render Web Service 100% active 24/7 (eliminates 502 cold-starts)."""
    counter = 0
    while True:
        try:
            with SessionLocal() as db:
                setting = db.query(AdminSettingsModel).filter(AdminSettingsModel.key == "worker_heartbeat").first()
                now_str = datetime.datetime.now(datetime.timezone.utc).isoformat()
                if not setting:
                    setting = AdminSettingsModel(key="worker_heartbeat", value=now_str)
                    db.add(setting)
                else:
                    setting.value = now_str
                db.commit()
        except Exception as e:
            logger.warning(f"[WORKER] Heartbeat error: {e}")

        # Ping web service every 4 minutes (every 4 loops) to prevent Render free-tier sleep
        counter += 1
        if counter % 4 == 0:
            try:
                web_url = os.environ.get("WEB_SERVICE_URL", "https://leetcodeurl-s-ipfr.onrender.com/health")
                import urllib.request
                req = urllib.request.Request(web_url, headers={"User-Agent": "RenderWorkerKeepAlive/1.0"})
                with urllib.request.urlopen(req, timeout=10) as _resp:
                    logger.info("[WORKER_KEEP_ALIVE] Render Web Service keep-alive ping success (200 OK).")
            except Exception as _ping_err:
                logger.debug(f"[WORKER_KEEP_ALIVE] Ping note: {_ping_err}")

        await asyncio.sleep(60)

async def run_worker():
    logger.info("[WORKER] Starting true cloud background worker...")
    
    # Optional: run migrations in worker only if explicitly requested (prevents startup lock contention with API)
    if os.environ.get("RUN_WORKER_MIGRATIONS", "false").lower() in ("true", "1"):
        try:
            run_db_migrations()
            run_migrations()
            logger.info("[WORKER] Database migrations completed.")
        except Exception as e:
            logger.warning(f"[WORKER] DB migrations note: {e}")
        
    # Start the robust scheduler
    start_scheduler()
    
    # Start heartbeat
    asyncio.create_task(heartbeat_loop())
    
    logger.info("[WORKER] Scheduler is running. Worker will stay alive 24/7.")
    
    # Keep the worker running indefinitely
    while True:
        await asyncio.sleep(3600)

if __name__ == "__main__":
    try:
        asyncio.run(run_worker())
    except KeyboardInterrupt:
        logger.info("[WORKER] Shutting down gracefully...")
