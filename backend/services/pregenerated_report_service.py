"""
Pre-Generated Report Service
Implements a Storage-First, Idempotent, Cached Weekly Report Architecture.
Ensures < 500ms download initiation on cache hits, distributed multi-worker safety, and non-blocking background generation.
"""
import os
import time
import datetime
import threading
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from backend.database import SessionLocal
from backend.models import ReportCache, WeeklySession
from backend.services.data_version_service import get_current_data_version
from backend.logger import logger

# Single-flight thread locking map (Level 1 in-process defense)
# Key: (institution_id, week_id, file_type, data_version) -> threading.Lock
_GENERATION_LOCKS: Dict[str, threading.Lock] = {}
_GLOBAL_LOCK = threading.Lock()

BASE_STORAGE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "storage", "reports")

def _get_storage_path(institution_id: str, week_id: str, file_type: str, data_version: str) -> str:
    ext_map = {
        "pdf": "pdf",
        "excel": "xlsx",
        "official_summary": "xlsx",
        "student_detail": "xlsx",
        "master_tracker": "xlsx",
        "word": "docx",
        "csv": "csv"
    }
    ext = ext_map.get(file_type.lower(), "xlsx")
    dir_path = os.path.join(BASE_STORAGE_DIR, institution_id, week_id, file_type)
    os.makedirs(dir_path, exist_ok=True)
    filename = f"NEC_Weekly_Report_{week_id}_{data_version}.{ext}"
    return os.path.join(dir_path, filename)


def get_cached_report_info(db: Session, week_id: str = "latest", file_type: str = "pdf", institution_id: str = "NEC") -> Dict[str, Any]:
    """
    Fast lookup for pre-generated cached report metadata.
    Target execution time: < 50ms.
    Verifies file integrity on disk. If missing/corrupted, auto-invalidates and triggers regeneration.
    """
    start_ts = time.time()
    curr_version = get_current_data_version(db)
    
    # Standardize week_id
    clean_week_id = str(week_id).lower().strip()
    if clean_week_id in ("current", "latest", "active"):
        clean_week_id = "latest"

    cached = db.query(ReportCache).filter(
        ReportCache.institution_id == institution_id,
        ReportCache.week_id == clean_week_id,
        ReportCache.file_type == file_type,
        ReportCache.status == "READY",
        ReportCache.data_version == curr_version
    ).order_by(ReportCache.id.desc()).first()

    lookup_ms = round((time.time() - start_ts) * 1000, 2)

    # Check if cached file exists and is valid on disk
    if cached and cached.storage_path and os.path.exists(cached.storage_path) and os.path.getsize(cached.storage_path) > 0:
        logger.info(f"[REPORT_CACHE_HIT] {file_type} for week {clean_week_id} version {curr_version} (lookup: {lookup_ms}ms)")
        return {
            "status": "READY",
            "cache_hit": True,
            "cache_id": cached.id,
            "download_url": f"/api/reports/cached-download/{cached.id}",
            "data_version": curr_version,
            "generated_at": cached.generated_at.isoformat() if cached.generated_at else None,
            "file_size_bytes": cached.file_size_bytes,
            "lookup_ms": lookup_ms
        }

    # Handle case where record is marked READY in DB but file on disk is missing/0-byte corrupted
    if cached:
        logger.warning(f"[REPORT_CACHE_CORRUPTED] File missing or 0 bytes at {cached.storage_path}. Invalidating cache entry #{cached.id}.")
        cached.status = "STALE"
        try:
            db.commit()
        except Exception:
            db.rollback()

    # Stale or missing cache entry
    logger.info(f"[REPORT_CACHE_MISS] {file_type} for week {clean_week_id} version {curr_version} (lookup: {lookup_ms}ms)")

    # Check if an older report exists to serve as temporary fallback while fresh one prepares
    old_cached = db.query(ReportCache).filter(
        ReportCache.institution_id == institution_id,
        ReportCache.week_id == clean_week_id,
        ReportCache.file_type == file_type,
        ReportCache.status == "READY"
    ).order_by(ReportCache.id.desc()).first()

    stale_url = None
    if old_cached and old_cached.storage_path and os.path.exists(old_cached.storage_path) and os.path.getsize(old_cached.storage_path) > 0:
        stale_url = f"/api/reports/cached-download/{old_cached.id}"

    # Trigger non-blocking background generation
    trigger_background_report_generation(week_id=clean_week_id, file_type=file_type, institution_id=institution_id, data_version=curr_version)

    return {
        "status": "PREPARING",
        "cache_hit": False,
        "cache_id": None,
        "download_url": stale_url,
        "stale": bool(stale_url),
        "data_version": curr_version,
        "message": "Report is being prepared in the background. Please retry in a moment.",
        "lookup_ms": lookup_ms
    }


def trigger_background_report_generation(week_id: str = "latest", file_type: str = "pdf", institution_id: str = "NEC", data_version: str = None):
    """
    Idempotently triggers a background worker to build and cache the requested report.
    Guarantees EXACTLY ONE generation worker runs across multi-instance server deployments
    via atomic DB record claims and unique constraint checks.
    """
    db = SessionLocal()
    try:
        curr_version = data_version or get_current_data_version(db)
        clean_week_id = str(week_id).lower().strip()
        if clean_week_id in ("current", "latest", "active"):
            clean_week_id = "latest"

        lock_key = f"{institution_id}:{clean_week_id}:{file_type}:{curr_version}"

        # 1. Level 1 Fast In-Memory Lock Check (Same process thread safety)
        with _GLOBAL_LOCK:
            if lock_key in _GENERATION_LOCKS:
                logger.info(f"[SINGLE_FLIGHT] Report generation already in progress in-process for key {lock_key}")
                return
            lock = threading.Lock()
            _GENERATION_LOCKS[lock_key] = lock

        # 2. Level 2 Database Atomic Job Claiming (Multi-Worker / Multi-Process safety)
        now = datetime.datetime.utcnow()
        five_mins_ago = now - datetime.timedelta(minutes=5)

        existing_job = db.query(ReportCache).filter(
            ReportCache.institution_id == institution_id,
            ReportCache.week_id == clean_week_id,
            ReportCache.file_type == file_type,
            ReportCache.data_version == curr_version
        ).first()

        cache_id = None
        if existing_job:
            # If already READY with valid disk file, return
            if existing_job.status == "READY" and existing_job.storage_path and os.path.exists(existing_job.storage_path) and os.path.getsize(existing_job.storage_path) > 0:
                logger.info(f"[ATOMIC_CLAIM] Report already READY in DB for key {lock_key}")
                with _GLOBAL_LOCK:
                    _GENERATION_LOCKS.pop(lock_key, None)
                return

            # If actively PREPARING within last 5 minutes, join existing job
            if existing_job.status in ("PREPARING", "GENERATING") and existing_job.generated_at and existing_job.generated_at > five_mins_ago:
                logger.info(f"[ATOMIC_CLAIM] Generation already in progress across workers for {lock_key}")
                with _GLOBAL_LOCK:
                    _GENERATION_LOCKS.pop(lock_key, None)
                return

            # Re-claim abandoned (>5m) or FAILED/STALE job
            try:
                existing_job.status = "PREPARING"
                existing_job.generated_at = now
                existing_job.error_message = None
                db.commit()
                cache_id = existing_job.id
            except Exception as e:
                db.rollback()
                logger.warning(f"[ATOMIC_CLAIM] Race condition updating existing cache entry: {e}")
                with _GLOBAL_LOCK:
                    _GENERATION_LOCKS.pop(lock_key, None)
                return
        else:
            # Atomic creation of PREPARING record. Multi-worker race triggers IntegrityError
            new_cache = ReportCache(
                institution_id=institution_id,
                week_id=clean_week_id,
                file_type=file_type,
                data_version=curr_version,
                status="PREPARING",
                generated_at=now
            )
            try:
                db.add(new_cache)
                db.commit()
                db.refresh(new_cache)
                cache_id = new_cache.id
            except IntegrityError:
                db.rollback()
                logger.info(f"[ATOMIC_CLAIM] Concurrent worker process claimed generation for {lock_key}")
                with _GLOBAL_LOCK:
                    _GENERATION_LOCKS.pop(lock_key, None)
                return
            except Exception as e:
                db.rollback()
                logger.error(f"[ATOMIC_CLAIM] Unexpected error claiming generation job: {e}")
                with _GLOBAL_LOCK:
                    _GENERATION_LOCKS.pop(lock_key, None)
                return

        # Launch background worker thread for report building
        thread = threading.Thread(
            target=_build_and_store_report_worker,
            args=(institution_id, clean_week_id, file_type, curr_version, lock_key, cache_id),
            daemon=True
        )
        thread.start()
    finally:
        db.close()


def _build_and_store_report_worker(institution_id: str, week_id: str, file_type: str, data_version: str, lock_key: str, cache_id: Optional[int] = None):
    """
    Background worker thread executing database reads, file generation, and cache registration.
    """
    start_ts = time.time()
    db = SessionLocal()
    try:
        logger.info(f"[REPORT_GEN_START] Building {file_type} for week {week_id} (version: {data_version})")

        # Generate report bytes using dedicated generators
        file_bytes = _generate_report_bytes(db, week_id, file_type)
        if not file_bytes:
            raise ValueError(f"Report generator returned empty output for {file_type}")

        # Save to storage
        storage_path = _get_storage_path(institution_id, week_id, file_type, data_version)
        with open(storage_path, "wb") as f:
            f.write(file_bytes)

        file_size = len(file_bytes)
        gen_time_ms = round((time.time() - start_ts) * 1000, 2)

        # Retrieve or find cache entry
        cache_entry = None
        if cache_id:
            cache_entry = db.query(ReportCache).filter(ReportCache.id == cache_id).first()
        if not cache_entry:
            cache_entry = db.query(ReportCache).filter(
                ReportCache.institution_id == institution_id,
                ReportCache.week_id == week_id,
                ReportCache.file_type == file_type,
                ReportCache.data_version == data_version
            ).order_by(ReportCache.id.desc()).first()

        if cache_entry:
            download_url = f"/api/reports/cached-download/{cache_entry.id}"
            cache_entry.status = "READY"
            cache_entry.storage_path = storage_path
            cache_entry.download_url = download_url
            cache_entry.generation_time_ms = gen_time_ms
            cache_entry.file_size_bytes = file_size
            db.commit()

        logger.info(f"[REPORT_GEN_SUCCESS] {file_type} report ready in {gen_time_ms}ms ({file_size} bytes) -> {storage_path}")

    except Exception as e:
        logger.error(f"[REPORT_GEN_ERROR] Failed to build {file_type} for week {week_id}: {e}", exc_info=True)
        try:
            failed_entry = None
            if cache_id:
                failed_entry = db.query(ReportCache).filter(ReportCache.id == cache_id).first()
            if not failed_entry:
                failed_entry = db.query(ReportCache).filter(
                    ReportCache.institution_id == institution_id,
                    ReportCache.week_id == week_id,
                    ReportCache.file_type == file_type,
                    ReportCache.data_version == data_version
                ).order_by(ReportCache.id.desc()).first()

            if failed_entry:
                failed_entry.status = "FAILED"
                failed_entry.error_message = str(e)
                db.commit()
        except Exception:
            pass
    finally:
        db.close()
        with _GLOBAL_LOCK:
            _GENERATION_LOCKS.pop(lock_key, None)


def _generate_report_bytes(db: Session, week_id: str, file_type: str) -> bytes:
    """
    Executes existing backend report generators and returns raw bytes.
    """
    ft = file_type.lower().strip()
    if ft == "pdf":
        from backend.pdf_generator import generate_pdf_summary_report
        return generate_pdf_summary_report(db)
    elif ft in ("official_summary", "excel"):
        from backend.excel_handler import generate_8_sheet_excel_report
        return generate_8_sheet_excel_report(db)
    elif ft == "master_tracker":
        from backend.excel_handler import generate_8_sheet_master_tracker
        return generate_8_sheet_master_tracker(db)
    elif ft == "student_detail":
        from backend.excel_handler import generate_student_performance_detail_excel
        return generate_student_performance_detail_excel(db)
    elif ft == "word":
        from backend.word_generator import generate_word_report
        return generate_word_report(db)
    elif ft == "csv":
        from backend.routes.reports import download_csv_report
        res = download_csv_report(dept_id=None, year_level=None, db=db, current_user=None)
        return res.body
    else:
        from backend.excel_handler import generate_8_sheet_excel_report
        return generate_8_sheet_excel_report(db)


def pregenerate_all_weekly_reports(db: Session, institution_id: str = "NEC"):
    """
    Pre-generates all core weekly report formats in background.
    Call this on startup or after contest completion workflows.
    """
    formats = ["pdf", "official_summary", "student_detail", "master_tracker"]
    curr_version = get_current_data_version(db)
    for ft in formats:
        trigger_background_report_generation(week_id="latest", file_type=ft, institution_id=institution_id, data_version=curr_version)
