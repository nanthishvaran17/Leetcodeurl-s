"""
backend/scripts/sync_student_academic_metadata.py

Synchronizes Student accommodation (Hostel / Day Scholar) and 12th Cutoff marks
from backend/data/student_academic_metadata.json into the target database (AWS or Local).

Handles:
- Full registration numbers (e.g. 732223CC001, 732224CI008)
- Short registration numbers (e.g. 23CC001, 24CI008)
- Matching by username or student name
- Clears report caches (DB and disk) so all reports immediately reflect the new data.
"""

import os
import sys
import json
import glob
import logging

# Ensure root directory is on Python path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(os.path.dirname(CURRENT_DIR))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.database import SessionLocal, engine
from backend.models import Student, ReportCache

logger = logging.getLogger("sync_student_academic_metadata")

def sync_academic_metadata(quiet: bool = False):
    if not quiet:
        print("=" * 70)
        print("[*] NANDHA LEETCODE TRACKER - STUDENT ACADEMIC METADATA SYNC")
        print("=" * 70)

    json_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "data",
        "student_academic_metadata.json"
    )

    if not os.path.exists(json_path):
        # Fallback check at root level or project level
        alt_path = os.path.join(PROJECT_ROOT, "backend", "data", "student_academic_metadata.json")
        if os.path.exists(alt_path):
            json_path = alt_path
        else:
            msg = f"[ERROR] Metadata file not found at: {json_path}"
            if not quiet:
                print(msg)
            logger.error(msg)
            return {"updated": 0, "error": "file_not_found"}

    with open(json_path, "r", encoding="utf-8") as f:
        meta_list = json.load(f)

    if not quiet:
        print(f"[*] Loaded {len(meta_list)} canonical student records from JSON.")

    # Build multi-index lookup dictionaries
    by_full_reg = {}
    by_short_reg = {}
    by_name = {}
    by_username = {}

    for item in meta_list:
        full_reg = (item.get("reg_no") or "").strip().upper()
        name = (item.get("name") or "").strip().upper()
        uname = (item.get("username") or "").strip().lower()

        if full_reg:
            by_full_reg[full_reg] = item
            # Short reg (e.g. 732223CC001 -> 23CC001, 732224CI008 -> 24CI008)
            short_reg = full_reg.replace("7322", "")
            by_short_reg[short_reg] = item
        if name:
            by_name[name] = item
        if uname:
            by_username[uname] = item

    db = SessionLocal()
    try:
        students = db.query(Student).all()
        if not quiet:
            print(f"[*] Found {len(students)} students in the active database ({engine.url}).")

        updated_cutoff_count = 0
        updated_accom_count = 0
        total_students_touched = 0

        for s in students:
            db_full_reg = (s.reg_no or "").strip().upper()
            db_short_reg = db_full_reg.replace("7322", "")
            db_name = (s.name or "").strip().upper()
            db_user = (s.username or "").strip().lower()

            matched = (
                by_full_reg.get(db_full_reg)
                or by_short_reg.get(db_short_reg)
                or (by_short_reg.get(db_full_reg) if db_full_reg in by_short_reg else None)
                or (by_full_reg.get(f"7322{db_full_reg}") if f"7322{db_full_reg}" in by_full_reg else None)
                or by_username.get(db_user)
                or by_name.get(db_name)
            )

            if not matched:
                continue

            changed = False
            new_accom = matched.get("accommodation")
            new_cutoff = matched.get("twelfth_cutoff")

            # Standardize accommodation: Day Scholar or Hostel / Hosteller
            if new_accom and str(new_accom).strip() not in ("—", "None", ""):
                clean_accom = str(new_accom).strip()
                if clean_accom != s.accommodation:
                    s.accommodation = clean_accom
                    updated_accom_count += 1
                    changed = True

            # Standardize cutoff: float
            if new_cutoff is not None and str(new_cutoff).strip() not in ("—", "None", ""):
                try:
                    f_cutoff = float(new_cutoff)
                    if s.twelfth_cutoff != f_cutoff:
                        s.twelfth_cutoff = f_cutoff
                        updated_cutoff_count += 1
                        changed = True
                except (ValueError, TypeError):
                    pass

            if changed:
                total_students_touched += 1

        db.commit()

        if not quiet:
            print(f"[OK] Updated Cutoff marks for : {updated_cutoff_count} records")
            print(f"[OK] Updated Accommodation for: {updated_accom_count} records")
            print(f"[OK] Total Students enriched  : {total_students_touched}")

        # Purge stale report caches so new reports compute immediately
        try:
            cached_count = db.query(ReportCache).count()
            if cached_count > 0:
                db.query(ReportCache).delete()
                db.commit()
                if not quiet:
                    print(f"[OK] Purged {cached_count} stale database report cache entries.")
        except Exception as cache_err:
            if not quiet:
                print(f"[!] Note on DB cache purge: {cache_err}")

        # Purge file-based cached reports on disk if any
        reports_dir = os.path.join(PROJECT_ROOT, "backend", "data", "reports")
        if os.path.exists(reports_dir):
            purged_files = 0
            for f in glob.glob(os.path.join(reports_dir, "*.*")):
                try:
                    os.remove(f)
                    purged_files += 1
                except Exception:
                    pass
            if not quiet and purged_files > 0:
                print(f"[OK] Purged {purged_files} file-based cached report files on disk.")

        if not quiet:
            print("=" * 70)
            print("[SUCCESS] SYNC COMPLETED SUCCESSFULLY!")
            print("=" * 70)

        return {
            "total_touched": total_students_touched,
            "cutoff_updated": updated_cutoff_count,
            "accom_updated": updated_accom_count
        }

    except Exception as e:
        db.rollback()
        msg = f"[ERROR] Failed to sync student metadata: {e}"
        if not quiet:
            print(msg)
        logger.error(msg)
        raise e
    finally:
        db.close()


if __name__ == "__main__":
    sync_academic_metadata(quiet=False)
