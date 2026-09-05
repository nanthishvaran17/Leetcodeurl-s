import datetime
import asyncio
import threading
from typing import Dict, Any, List, Optional
import uuid

from backend.database import SessionLocal
from backend.logger import logger

# In-memory progress tracker for quick polling & live WebSocket push
class ExcelImportTracker:
    def __init__(self):
        self.current_job_id: Optional[str] = None
        self.is_running: bool = False
        self.status: str = "IDLE"
        self.triggered_by: Optional[str] = None
        self.total_rows: int = 0
        self.processed_rows: int = 0
        self.successful: int = 0
        self.failed: int = 0
        self.progress_percentage: float = 0.0
        self.started_at: Optional[str] = None
        self.completed_at: Optional[str] = None
        self.error_summary: Optional[str] = None
        self.recent_logs: List[str] = []
        self.new_departments: List[str] = []

    def start(self, job_id: str, total_rows: int, triggered_by: str = "admin"):
        now_iso = datetime.datetime.utcnow().isoformat()
        self.current_job_id = job_id
        self.is_running = True
        self.status = "RUNNING"
        self.triggered_by = triggered_by
        self.total_rows = total_rows
        self.processed_rows = 0
        self.successful = 0
        self.failed = 0
        self.progress_percentage = 0.0
        self.started_at = now_iso
        self.completed_at = None
        self.error_summary = None
        self.recent_logs = [f"[IMPORT] Started excel import job {job_id} for {total_rows} rows."]
        self.new_departments = []

    def update(self, processed_inc=1, success_inc=0, failed_inc=0, log_msg=""):
        self.processed_rows += processed_inc
        self.successful += success_inc
        self.failed += failed_inc
        self.progress_percentage = round((self.processed_rows / max(1, self.total_rows)) * 100.0, 2)
        if log_msg:
            self.recent_logs.append(log_msg)
            if len(self.recent_logs) > 50:
                self.recent_logs.pop(0)

        # Broadcast live progress over WebSocket
        try:
            from backend.websocket_manager import manager
            dispatch_import_task(manager.broadcast({
                "type": "IMPORT_PROGRESS",
                "job_id": self.current_job_id,
                "status": self.status,
                "total": self.total_rows,
                "processed": self.processed_rows,
                "successful": self.successful,
                "failed": self.failed,
                "progress_percentage": self.progress_percentage,
                "recent_logs": self.recent_logs[-5:]
            }))
        except Exception:
            pass

    def finish(self, status: str = "COMPLETED", error_summary: Optional[str] = None):
        self.is_running = False
        self.status = status
        self.completed_at = datetime.datetime.utcnow().isoformat()
        if status == "COMPLETED":
            self.progress_percentage = 100.0
            self.processed_rows = self.total_rows
        self.error_summary = error_summary

    def to_dict(self) -> Dict[str, Any]:
        return {
            "job_id": self.current_job_id,
            "is_running": self.is_running,
            "status": self.status,
            "total_rows": self.total_rows,
            "processed_rows": self.processed_rows,
            "successful": self.successful,
            "failed": self.failed,
            "progress_percentage": self.progress_percentage,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "error_summary": self.error_summary,
            "recent_logs": self.recent_logs,
            "new_departments": self.new_departments
        }

import_tracker = ExcelImportTracker()

async def broadcast_import_event(event_data: Dict[str, Any]):
    """Broadcasts import events over WebSocket."""
    try:
        from backend.websocket_manager import manager
        await manager.broadcast(event_data)
    except Exception as e:
        logger.warning(f"WebSocket broadcast error: {e}")

_background_tasks = set()

def dispatch_import_task(coro):
    """Dispatches async coroutine task reliably."""
    try:
        loop = asyncio.get_running_loop()
        task = loop.create_task(coro)
        _background_tasks.add(task)
        task.add_done_callback(_background_tasks.discard)
    except RuntimeError:
        t = threading.Thread(target=asyncio.run, args=(coro,), daemon=True)
        t.start()

def validate_excel_import_file(file_bytes: bytes) -> Dict[str, Any]:
    """
    Parses and validates uploaded Excel roster bytes prior to database insertion.
    Returns row breakdown, valid count, invalid count, duplicates, and error preview.
    """
    import io
    import pandas as pd
    from backend.models import Student
    
    db = SessionLocal()
    try:
        try:
            df = pd.read_excel(io.BytesIO(file_bytes))
        except Exception:
            df = pd.read_csv(io.BytesIO(file_bytes))

        if df.empty:
            return {
                "success": False,
                "total_rows": 0,
                "valid_rows": 0,
                "invalid_rows": 0,
                "duplicate_rows": 0,
                "missing_fields": 0,
                "errors": ["Uploaded file is empty or unreadable."],
                "preview": []
            }

        # Normalize column headers
        df.columns = [str(c).strip().lower().replace(" ", "_").replace(".", "") for c in df.columns]
        
        # Existing database reg_nos for duplicate checking
        existing_reg_nos = set(r[0] for r in db.query(Student.reg_no).all() if r[0])

        total_rows = len(df)
        valid_rows = 0
        invalid_rows = 0
        duplicate_rows = 0
        missing_fields = 0
        errors = []
        preview = []
        seen_in_file = set()

        for idx, row in df.iterrows():
            row_num = idx + 2 # 1-based index + header row
            reg_no = str(row.get("register_no") or row.get("reg_no") or row.get("register_number") or "").strip()
            name = str(row.get("name") or row.get("student_name") or "").strip()
            dept = str(row.get("department") or row.get("dept") or row.get("branch") or "").strip()
            year = str(row.get("year") or row.get("year_level") or "").strip()

            if not reg_no or not name:
                missing_fields += 1
                invalid_rows += 1
                if len(errors) < 15:
                    errors.append(f"Row {row_num}: Missing required field (Register No or Name)")
                continue

            if reg_no in seen_in_file or reg_no in existing_reg_nos:
                duplicate_rows += 1

            seen_in_file.add(reg_no)
            valid_rows += 1

            if len(preview) < 5:
                preview.append({
                    "reg_no": reg_no,
                    "name": name,
                    "dept": dept,
                    "year": year,
                    "is_duplicate": reg_no in existing_reg_nos
                })

        return {
            "success": True,
            "total_rows": total_rows,
            "valid_rows": valid_rows,
            "invalid_rows": invalid_rows,
            "duplicate_rows": duplicate_rows,
            "missing_fields": missing_fields,
            "errors": errors,
            "preview": preview
        }
    except Exception as e:
        logger.error(f"[VALIDATE_IMPORT_ERROR] {e}", exc_info=True)
        return {
            "success": False,
            "total_rows": 0,
            "valid_rows": 0,
            "invalid_rows": 0,
            "duplicate_rows": 0,
            "missing_fields": 0,
            "errors": [f"Failed to parse import file: {str(e)}"],
            "preview": []
        }
    finally:
        db.close()


def start_excel_import_job(file_bytes: bytes, filename: str, triggered_by: str = "admin") -> Dict[str, Any]:

    """
    Initiates an asynchronous background Excel import job.
    """
    if import_tracker.is_running:
        return {
            "success": False,
            "status": "IMPORT_ALREADY_RUNNING",
            "job_id": import_tracker.current_job_id,
            "message": "An import job is already in progress."
        }

    job_id = f"IMPORT-{uuid.uuid4().hex[:8].upper()}"
    
    # We estimate total rows later when pandas reads it. We just initialize the tracker.
    import_tracker.start(job_id, 1, triggered_by=triggered_by)

    dispatch_import_task(_run_excel_import_worker(job_id, file_bytes, triggered_by))

    return {
        "success": True,
        "job_id": job_id,
        "status": "RUNNING",
        "message": "Started background Excel import job."
    }

async def _run_excel_import_worker(job_id: str, file_bytes: bytes, triggered_by: str):
    logger.info(f"[IMPORT WORKER] Started for job: {job_id}")
    db = SessionLocal()
    try:
        from backend.excel_handler import run_high_speed_excel_import
        
        # Run the CPU-bound/blocking bulk import inside a threadpool or just directly if fast enough
        loop = asyncio.get_running_loop()
        summary = await loop.run_in_executor(None, run_high_speed_excel_import, db, file_bytes, job_id, import_tracker)
        
        import_tracker.finish("COMPLETED")
        
        # Invalidate cache
        try:
            from backend.cache import cache
            cache.invalidate_tag("students")
            cache.invalidate_tag("settings")
            cache.clear()
        except Exception:
            pass

        await broadcast_import_event({
            "type": "IMPORT_COMPLETED",
            "job_id": job_id,
            "status": "COMPLETED",
            "summary": summary
        })

        # Phase B: Trigger background LeetCode verification for newly imported users
        new_ids = summary.get("new_student_ids", [])
        if new_ids:
            try:
                from backend.services.live_sync_service import start_targeted_sync_job
                start_targeted_sync_job(db, student_ids=new_ids, triggered_by=f"excel_import_{triggered_by}")
            except Exception as e:
                logger.error(f"[EXCEL_IMPORT] Failed to trigger background sync: {e}")

    except Exception as exc:
        logger.error(f"[IMPORT WORKER] Job {job_id} failed: {exc}", exc_info=True)
        import_tracker.finish("FAILED", str(exc))
        await broadcast_import_event({
            "type": "IMPORT_FAILED",
            "job_id": job_id,
            "error": str(exc)
        })
    finally:
        db.close()
