from fastapi import APIRouter, BackgroundTasks, HTTPException, Query
from typing import Optional, Dict, Any

from backend.sync_engine import run_batch_sync, sync_single_student_by_id, sync_tracker

router = APIRouter(prefix="/api/sync", tags=["LeetCode Sync"])

@router.get("/status")
def get_sync_status():
    """
    Returns real-time synchronization progress.
    """
    return sync_tracker.to_dict()

@router.post("/all")
async def sync_all_students(
    background_tasks: BackgroundTasks,
    limit: Optional[int] = Query(None, description="Limit number of students to sync (for testing)"),
    max_workers: int = Query(3, description="Number of concurrent fetch workers"),
):
    """
    Triggers controlled queue LeetCode synchronization for all active students (or limited N students).
    Runs asynchronously in background without blocking web requests.
    """
    if sync_tracker.is_running:
        return {
            "message": "Sync is already in progress.",
            "status": "busy",
            "progress": sync_tracker.to_dict()
        }

    background_tasks.add_task(run_batch_sync, limit=limit, max_workers=max_workers)
    
    return {
        "message": f"LeetCode synchronization started in background{' (limit=' + str(limit) + ')' if limit else ''}.",
        "status": "processing",
        "sync_status_url": "/api/sync/status"
    }

@router.post("/student/{student_id}")
async def sync_single_student(student_id: int):
    """
    Synchronizes LeetCode data for a single student.
    """
    try:
        result = await sync_single_student_by_id(student_id)
        if result.get("status") == "failed":
            raise HTTPException(status_code=400, detail=result.get("error", "Sync failed"))
        return result
    except ValueError as val_err:
        raise HTTPException(status_code=404, detail=str(val_err))
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Sync error: {err}")
