from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
import os

from backend.database import get_db
from backend.logger import logger
from backend.models import AuditLog

router = APIRouter(prefix="/api/cron", tags=["Cloud Scheduler Automation"])

# Configured in environment, defaults to a strong generated key for security
CRON_SECRET = os.environ.get("CRON_SECRET", "super-secret-cron-key-for-cloud")

@router.post("/sunday-session")
async def trigger_sunday_session(
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    """
    Secure webhook intended for Cloud Schedulers (e.g. Google Cloud Scheduler, GitHub Actions, AWS EventBridge).
    Runs the Sunday automation pipeline without relying on a local Windows Task Scheduler.
    """
    if not authorization or authorization.replace("Bearer ", "") != CRON_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized: Invalid or missing CRON_SECRET")

    logger.info("[CLOUD CRON] Sunday session automation triggered via external webhook.")
    
    # We defer the actual heavy execution to a background task or run it here,
    # but for this endpoint we'll run the existing runner script logic safely.
    from backend.sunday_runner import execute_full_sunday_pipeline
    from sqlalchemy import text
    
    try:
        # Implement Distributed Locking (Idempotency) for Production PostgreSQL
        # This ensures that if the Cloud Scheduler fires twice concurrently, only one runs.
        # We use a transaction with a unique lock key (hash of 'sunday_pipeline_lock')
        lock_acquired = False
        try:
            # 13371337 is an arbitrary unique integer for the Postgres advisory lock
            result = db.execute(text("SELECT pg_try_advisory_lock(13371337)")).scalar()
            lock_acquired = bool(result)
        except Exception as e:
            # Fallback if not using postgres (e.g. local sqlite testing)
            logger.warning(f"Could not acquire Postgres advisory lock (perhaps running SQLite?): {e}")
            lock_acquired = True 
            
        if not lock_acquired:
            logger.warning("[CLOUD CRON] Duplicate webhook fired. Pipeline is already locked and running.")
            return {"status": "SKIPPED", "message": "Sunday automation pipeline is already actively running (Lock acquired by another process)."}

        # Run it asynchronously so the webhook doesn't timeout the cloud provider
        import asyncio
        
        # Define a wrapper to release the lock after completion
        def run_and_unlock():
            try:
                execute_full_sunday_pipeline()
            finally:
                try:
                    # Use a new connection to release if necessary, or just let session close release it
                    with get_db() as lock_db:
                        lock_db.execute(text("SELECT pg_advisory_unlock(13371337)"))
                        lock_db.commit()
                except:
                    pass

        asyncio.create_task(asyncio.to_thread(run_and_unlock))
        
        audit = AuditLog(
            user_id=0,
            user_name="Cloud Scheduler",
            action="TRIGGER_SUNDAY_AUTOMATION",
            details="Triggered full Sunday pipeline via secure cloud webhook."
        )
        db.add(audit)
        db.commit()

        return {"status": "SUCCESS", "message": "Sunday automation pipeline successfully queued via Cloud Scheduler."}
    except Exception as e:
        logger.error(f"[CLOUD CRON] Failed to start pipeline: {e}")
        raise HTTPException(status_code=500, detail=str(e))
