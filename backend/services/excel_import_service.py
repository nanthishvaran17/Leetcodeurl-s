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

        # Throttle WebSocket broadcasts to max 2 times per second to prevent thread spawning overhead
        import time
        if not hasattr(self, '_last_broadcast_time'):
            self._last_broadcast_time = 0.0
            
        current_time = time.time()
        # Force broadcast if finished or if 0.5s has elapsed
        if current_time - self._last_broadcast_time < 0.5 and self.processed_rows < self.total_rows:
            return
            
        self._last_broadcast_time = current_time

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

def analyze_excel_import(file_bytes: bytes, custom_mapping: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
    """
    Intelligently analyzes uploaded Excel bytes without writing to production DB.
    Detects headers, computes confidence scores, normalizes data values,
    checks existing records for CREATE/UPDATE/UNCHANGED classification,
    and identifies newly discovered departments.
    """
    import io
    import pandas as pd
    from backend.models import Student, Department
    from backend.services.excel_intelligence_engine import (
        detect_column_headers, normalize_year_value, normalize_batch_value,
        normalize_department_value, normalize_leetcode_url, CANONICAL_FIELDS
    )

    db = SessionLocal()
    try:
        try:
            df = pd.read_excel(io.BytesIO(file_bytes))
        except Exception:
            df = pd.read_csv(io.BytesIO(file_bytes))

        if df.empty:
            return {
                "success": False,
                "error": "Uploaded Excel file is empty or unreadable.",
                "total_rows": 0
            }

        raw_headers = [str(c).strip() for c in df.columns]
        auto_mappings, confidence_map, unmapped = detect_column_headers(raw_headers)

        effective_mapping = {**auto_mappings, **(custom_mapping or {})}

        # Reverse map: canonical_field -> raw_header
        canonical_to_raw = {v: k for k, v in effective_mapping.items()}

        # Load existing reference data
        dept_master = {d.code.upper(): d for d in db.query(Department).all()}
        for d in db.query(Department).all():
            if d.name:
                dept_master[d.name.upper()] = d

        existing_students_reg = {s.reg_no.strip().upper(): s for s in db.query(Student).all() if s.reg_no}
        existing_depts_set = set(dept_master.keys())

        total_rows = len(df)
        create_rows = []
        update_rows = []
        unchanged_rows = []
        error_rows = []
        warning_rows = []
        new_departments_set = set()
        seen_reg_nos = set()

        for idx, row in df.iterrows():
            row_num = idx + 2  # 1-based + header row

            def _get_val(canonical_key: str) -> str:
                raw_col = canonical_to_raw.get(canonical_key)
                if raw_col and raw_col in row and pd.notna(row[raw_col]):
                    return str(row[raw_col]).strip()
                return ""

            reg_no = _get_val("reg_no").upper()
            name = _get_val("name")
            raw_dept = _get_val("department")
            raw_year = _get_val("year_level")
            raw_email = _get_val("email")
            raw_lc_url = _get_val("leetcode_url")
            raw_sec_lc = _get_val("sec_leetcode_url")
            raw_section = _get_val("section")
            raw_batch = _get_val("batch")

            if not reg_no or not name:
                error_rows.append({
                    "row_num": row_num,
                    "reg_no": reg_no or "N/A",
                    "name": name or "N/A",
                    "error": "Missing required field (Reg No or Name)"
                })
                continue

            if reg_no in seen_reg_nos:
                warning_rows.append({
                    "row_num": row_num,
                    "reg_no": reg_no,
                    "name": name,
                    "warning": f"Duplicate Reg No '{reg_no}' inside the same Excel file. Second occurrence skipped."
                })
                continue
            seen_reg_nos.add(reg_no)

            # Normalization
            norm_year, year_conf = normalize_year_value(raw_year)
            norm_batch, batch_conf = normalize_batch_value(raw_batch)
            dept_code, dept_id, dept_conf, is_new_dept = normalize_department_value(raw_dept, dept_master)
            lc_url, lc_username = normalize_leetcode_url(raw_lc_url)
            sec_lc_url, sec_username = normalize_leetcode_url(raw_sec_lc) if raw_sec_lc else (None, None)

            if is_new_dept and raw_dept:
                new_departments_set.add(raw_dept.upper())

            # Row classification: CREATE vs UPDATE vs UNCHANGED
            existing_st = existing_students_reg.get(reg_no)

            row_summary = {
                "row_num": row_num,
                "reg_no": reg_no,
                "name": name,
                "dept": dept_code,
                "year": norm_year,
                "email": raw_email,
                "leetcode_url": lc_url or raw_lc_url,
                "leetcode_username": lc_username,
                "section": raw_section or None,
                "batch": norm_batch,
                "is_new_dept": is_new_dept
            }

            if not existing_st:
                row_summary["status"] = "CREATE"
                create_rows.append(row_summary)
            else:
                # Compare fields to determine UPDATE vs UNCHANGED
                diffs = []
                if existing_st.name and existing_st.name.strip().upper() != name.upper():
                    diffs.append(f"Name: '{existing_st.name}' → '{name}'")
                if existing_st.department and existing_st.department.code.upper() != dept_code.upper():
                    diffs.append(f"Department: '{existing_st.department.code}' → '{dept_code}'")
                if existing_st.year_level and existing_st.year_level.strip().upper() != norm_year.upper():
                    diffs.append(f"Year: '{existing_st.year_level}' → '{norm_year}'")
                if existing_st.email and raw_email and existing_st.email.strip().lower() != raw_email.lower():
                    diffs.append(f"Email: '{existing_st.email}' → '{raw_email}'")
                if existing_st.username and lc_username and existing_st.username.strip().lower() != lc_username.lower():
                    diffs.append(f"LeetCode: '@{existing_st.username}' → '@{lc_username}'")

                row_summary["diffs"] = diffs

                if diffs:
                    row_summary["status"] = "UPDATE"
                    update_rows.append(row_summary)
                else:
                    row_summary["status"] = "UNCHANGED"
                    unchanged_rows.append(row_summary)

        return {
            "success": True,
            "raw_headers": raw_headers,
            "detected_mapping": auto_mappings,
            "confidence_map": confidence_map,
            "unmapped_headers": unmapped,
            "canonical_fields_info": {k: v["label"] for k, v in CANONICAL_FIELDS.items()},
            "summary": {
                "total_rows": total_rows,
                "create_count": len(create_rows),
                "update_count": len(update_rows),
                "unchanged_count": len(unchanged_rows),
                "warning_count": len(warning_rows),
                "error_count": len(error_rows),
                "new_departments": list(new_departments_set)
            },
            "preview_data": {
                "create": create_rows[:10],
                "update": update_rows[:10],
                "unchanged": unchanged_rows[:5],
                "errors": error_rows[:10],
                "warnings": warning_rows[:10]
            }
        }
    except Exception as e:
        logger.error(f"[ANALYZE_IMPORT_ERROR] {e}", exc_info=True)
        return {
            "success": False,
            "error": f"Failed to analyze Excel import file: {str(e)}",
            "total_rows": 0
        }
    finally:
        db.close()


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


def commit_smart_excel_import(
    file_bytes: bytes,
    custom_mapping: Optional[Dict[str, str]] = None,
    confirmed_new_departments: Optional[List[str]] = None,
    triggered_by_user: Optional[Any] = None
) -> Dict[str, Any]:
    """
    Executes the intelligent Excel import commit.
    Registers new departments, updates existing student records without duplicating reg_no,
    creates new students, invalidates cache, logs audit events, and triggers background LeetCode sync.
    """
    import io
    import pandas as pd
    from backend.models import Student, Department
    from backend.services.excel_intelligence_engine import (
        detect_column_headers, normalize_year_value, normalize_batch_value,
        normalize_department_value, normalize_leetcode_url, CANONICAL_FIELDS
    )
    from backend.services.audit_service import log_admin_action
    from backend.cache import cache

    db = SessionLocal()
    try:
        try:
            df = pd.read_excel(io.BytesIO(file_bytes))
        except Exception:
            df = pd.read_csv(io.BytesIO(file_bytes))

        if df.empty:
            return {"success": False, "error": "Uploaded Excel file is empty."}

        raw_headers = [str(c).strip() for c in df.columns]
        auto_mappings, _, _ = detect_column_headers(raw_headers)
        effective_mapping = {**auto_mappings, **(custom_mapping or {})}
        canonical_to_raw = {v: k for k, v in effective_mapping.items()}

        # 1. Register confirmed/detected new departments
        new_dept_codes = confirmed_new_departments or []
        created_depts_list = []

        existing_depts_db = {d.code.upper(): d for d in db.query(Department).all()}
        for code in new_dept_codes:
            code_upper = str(code).strip().upper()
            if code_upper and code_upper not in existing_depts_db:
                new_d = Department(code=code_upper, name=f"{code_upper} Department")
                db.add(new_d)
                db.flush()
                existing_depts_db[code_upper] = new_d
                created_depts_list.append(code_upper)
                
                # Broadcast WebSocket event for real-time dynamic department propagation across app
                dispatch_import_task(broadcast_import_event({
                    "type": "DEPARTMENT_CREATED",
                    "code": code_upper,
                    "name": f"{code_upper} Department",
                    "id": new_d.id
                }))

        # Load complete department lookup map (by code & name)
        dept_master = {}
        for d in db.query(Department).all():
            if d.code: dept_master[d.code.upper()] = d
            if d.name: dept_master[d.name.upper()] = d

        # 2. Existing student index by reg_no
        existing_students_reg = {
            s.reg_no.strip().upper(): s for s in db.query(Student).all() if s.reg_no
        }

        seen_reg_nos = set()
        created_count = 0
        updated_count = 0
        unchanged_count = 0
        error_rows = []
        warning_rows = []
        affected_student_ids = []

        for idx, row in df.iterrows():
            row_num = idx + 2

            def _get_val(canonical_key: str) -> str:
                raw_col = canonical_to_raw.get(canonical_key)
                if raw_col and raw_col in row and pd.notna(row[raw_col]):
                    return str(row[raw_col]).strip()
                return ""

            reg_no = _get_val("reg_no").upper()
            name = _get_val("name")
            raw_dept = _get_val("department")
            raw_year = _get_val("year_level")
            raw_email = _get_val("email")
            raw_lc_url = _get_val("leetcode_url")
            raw_sec_lc = _get_val("sec_leetcode_url")
            raw_section = _get_val("section")
            raw_batch = _get_val("batch")

            if not reg_no or not name:
                error_rows.append({"row_num": row_num, "reg_no": reg_no or "N/A", "error": "Missing Reg No or Name"})
                continue

            if reg_no in seen_reg_nos:
                warning_rows.append({"row_num": row_num, "reg_no": reg_no, "warning": f"Duplicate Reg No '{reg_no}' inside Excel sheet skipped."})
                continue
            seen_reg_nos.add(reg_no)

            norm_year, _ = normalize_year_value(raw_year)
            norm_batch, _ = normalize_batch_value(raw_batch)
            dept_code, dept_id, _, _ = normalize_department_value(raw_dept, dept_master)
            lc_url, lc_username = normalize_leetcode_url(raw_lc_url)

            # Resolve department_id if missing
            if not dept_id and dept_code in dept_master:
                dept_id = dept_master[dept_code].id

            existing_st = existing_students_reg.get(reg_no)

            if not existing_st:
                # CREATE
                email_val = raw_email or f"{reg_no.lower()}@nandha.edu.in"
                new_st = Student(
                    reg_no=reg_no,
                    name=name,
                    department_id=dept_id,
                    year_level=norm_year,
                    email=email_val,
                    username=lc_username,
                    leetcode_url=lc_url,
                    batch=norm_batch,
                    is_active=True
                )
                db.add(new_st)
                db.flush()
                created_count += 1
                affected_student_ids.append(new_st.id)
            else:
                # UPDATE check
                has_changes = False
                if name and existing_st.name != name:
                    existing_st.name = name
                    has_changes = True
                if dept_id and existing_st.department_id != dept_id:
                    existing_st.department_id = dept_id
                    has_changes = True
                if norm_year and existing_st.year_level != norm_year:
                    existing_st.year_level = norm_year
                    has_changes = True
                if raw_email and existing_st.email != raw_email:
                    existing_st.email = raw_email
                    has_changes = True
                if lc_username and existing_st.username != lc_username:
                    existing_st.username = lc_username
                    existing_st.leetcode_url = lc_url
                    has_changes = True
                if norm_batch and existing_st.batch != norm_batch:
                    existing_st.batch = norm_batch
                    has_changes = True

                if has_changes:
                    updated_count += 1
                    affected_student_ids.append(existing_st.id)
                else:
                    unchanged_count += 1

        db.commit()

        # Invalidate Caches
        try:
            cache.clear()
            cache.invalidate_tag("students")
            cache.invalidate_tag("settings")
            cache.invalidate_tag("departments")
        except Exception:
            pass

        # Audit Log
        try:
            log_admin_action(
                db=db,
                action="SMART_EXCEL_IMPORT",
                action_type="IMPORT",
                description=f"Smart Excel import: {created_count} created, {updated_count} updated, {unchanged_count} unchanged.",
                current_user=triggered_by_user,
                metadata_json={
                    "created": created_count,
                    "updated": updated_count,
                    "unchanged": unchanged_count,
                    "errors": len(error_rows),
                    "new_departments": created_depts_list
                }
            )
        except Exception as ae:
            logger.warning(f"Audit log writing failed: {ae}")

        # Broadcast completion event
        dispatch_import_task(broadcast_import_event({
            "type": "IMPORT_COMPLETED",
            "summary": {
                "new_students": created_count,
                "existing_updated": updated_count,
                "unchanged": unchanged_count,
                "new_departments": created_depts_list
            }
        }))

        # Trigger background LeetCode sync for newly added/updated students
        if affected_student_ids:
            try:
                from backend.services.live_sync_service import start_targeted_sync_job
                start_targeted_sync_job(db, student_ids=affected_student_ids, triggered_by="smart_excel_import")
            except Exception as se:
                logger.error(f"[SMART_EXCEL_IMPORT] LeetCode sync trigger failed: {se}")

        return {
            "success": True,
            "summary": {
                "new_students": created_count,
                "existing_updated": updated_count,
                "unchanged": unchanged_count,
                "rejected": len(error_rows),
                "new_departments": len(created_depts_list),
                "leetcode_synced": len(affected_student_ids),
                "leetcode_pending": 0
            },
            "errors": error_rows,
            "warnings": warning_rows,
            "new_departments_created": created_depts_list
        }
    except Exception as e:
        db.rollback()
        logger.error(f"[COMMIT_IMPORT_ERROR] {e}", exc_info=True)
        return {"success": False, "error": f"Import failed: {str(e)}"}
    finally:
        db.close()

