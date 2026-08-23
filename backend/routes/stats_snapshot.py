"""
stats_snapshot.py — CANONICAL LATEST SUCCESSFUL SNAPSHOT REST API
==================================================================
Exposes current verified snapshot and lightweight version checking endpoints.
Sets strict Cache-Control headers to ensure zero stale browser state.
"""

from fastapi import APIRouter, Depends, Response, HTTPException
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.services.snapshot_manager import authoritative_snapshot_engine
from backend.models import OfficialWeeklySnapshot

router = APIRouter(prefix="/stats", tags=["Authoritative Stats Snapshot"])


@router.get("/version")
@router.get("/current/version")
def get_current_stats_version(response: Response, db: Session = Depends(get_db)):
    """
    Lightweight version check for client-side auto-update triggers.
    Allows frontend to detect new snapshots without downloading full 1,450 records.
    """
    response.headers["Cache-Control"] = "no-cache, must-revalidate, max-age=0"
    return authoritative_snapshot_engine.get_latest_version_info(db)


@router.get("/current")
def get_current_authoritative_stats(response: Response, db: Session = Depends(get_db)):
    """
    Canonical Single Source of Truth for current student statistics.
    Every new visitor and page open resolves to LATEST_SUCCESSFUL_SNAPSHOT.
    """
    data = authoritative_snapshot_engine.get_current_snapshot(db)
    ver = data.get("data_version", 100)
    
    response.headers["Cache-Control"] = "no-cache, must-revalidate, max-age=0"
    response.headers["ETag"] = f'W/"snapshot-{ver}"'
    response.headers["X-Data-Version"] = str(ver)
    return data


@router.get("/snapshots/{snapshot_id}")
def get_historical_snapshot(snapshot_id: str, db: Session = Depends(get_db)):
    """
    Fetches an explicit historical snapshot without altering the current data pointer.
    """
    import re
    m = re.search(r"\d+", snapshot_id)
    if not m:
        raise HTTPException(status_code=400, detail="Invalid snapshot identifier")
    
    snap_num = int(m.group(0))
    # Check if snap_num is version or ID
    db_id = snap_num - 100 if snap_num > 100 else snap_num
    snap = db.query(OfficialWeeklySnapshot).filter(OfficialWeeklySnapshot.id == db_id).first()
    if not snap:
        raise HTTPException(status_code=404, detail="Historical snapshot not found")
    
    return {
        "snapshot_id": f"SNAPSHOT-{snap.contest_id}-{100 + snap.id}",
        "data_version": 100 + snap.id,
        "synced_at": snap.finalized_at.isoformat() if snap.finalized_at else None,
        "dataset": snap.dataset
    }
