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
    """Write heartbeat to DB every 60s so web process can verify worker is alive."""
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
        await asyncio.sleep(60)

async def run_worker():
    logger.info("[WORKER] Starting true cloud background worker...")
    
    # Optional: run migrations before starting worker
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
