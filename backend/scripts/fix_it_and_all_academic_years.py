"""
fix_it_and_all_academic_years.py
=================================
Fixes academic year mappings across the entire database based on Register Numbers:
  - 24IT / 732224... -> III Year (3rd Year, Batch 2024-2028)
  - 25IT / 732225... -> II Year  (2nd Year, Batch 2025-2029)
  - 23...            -> IV Year  (Final Year, Batch 2023-2027)
  - 26...            -> I Year   (1st Year, Batch 2026-2030)

Updates both `Student.year_level` and all historical/current `WeeklyPublicResult.year`
and clears all dashboard caches.

Usage on AWS EC2:
  /var/www/leetcode-tracker/.venv/bin/python3 backend/scripts/fix_it_and_all_academic_years.py
"""

import os
import sys

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from sqlalchemy import func
from backend.database import SessionLocal, engine
from backend.models import Student, Department, WeeklyPublicResult, WeeklySession
from backend.cache import cache

# Configure sqlite timeout and WAL mode
if "sqlite" in str(engine.url):
    with engine.connect() as conn:
        try:
            conn.exec_driver_sql("PRAGMA journal_mode=WAL;")
            conn.exec_driver_sql("PRAGMA busy_timeout=60000;")
        except Exception:
            pass

def run_fix():
    print("=" * 65)
    print("🎓 FIXING ACADEMIC YEARS & IT DEPARTMENT SEPARATION")
    print("=" * 65)

    db = SessionLocal()
    try:
        # 1. Ensure IT Department exists
        dept_it = db.query(Department).filter(
            (Department.code == 'IT') | (Department.name.ilike('%information technology%'))
        ).first()

        if not dept_it:
            print("[INFO] Creating 'IT' department entry...")
            dept_it = Department(code='IT', name='Information Technology')
            db.add(dept_it)
            db.commit()
            db.refresh(dept_it)
        else:
            dept_it.code = 'IT'
            db.commit()

        # 2. Process all active students
        students = db.query(Student).all()
        print(f"[INFO] Evaluating {len(students)} students in database...")

        updated_students = 0
        year_counts = {"I Year": 0, "II Year": 0, "III Year": 0, "IV Year": 0}
        it_counts = {"II Year": 0, "III Year": 0, "Other": 0}

        for s in students:
            reg = (s.reg_no or "").strip().upper()
            if not reg or reg.startswith("REG_") or reg.startswith("TEST"):
                continue

            # Determine Year based on Register Number
            if "732225" in reg or "73225" in reg or "25IT" in reg or "25CC" in reg or "25CI" in reg or "25CS" in reg:
                target_year = "II Year"
                batch = "2025-2029"
            elif "732224" in reg or "24IT" in reg or "24CC" in reg or "24CI" in reg or "24CS" in reg:
                target_year = "III Year"
                batch = "2024-2028"
            elif "732223" in reg or "23IT" in reg or "23CC" in reg or "23CI" in reg or "23CS" in reg:
                target_year = "IV Year"
                batch = "2023-2027"
            elif "732226" in reg or "26IT" in reg or "26CC" in reg or "26CI" in reg or "26CS" in reg:
                target_year = "I Year"
                batch = "2026-2030"
            else:
                # Fallback check
                if "24" in reg:
                    target_year = "III Year"
                    batch = "2024-2028"
                elif "25" in reg:
                    target_year = "II Year"
                    batch = "2025-2029"
                else:
                    raw_y = str(s.year_level or "III").replace("Year", "").strip()
                    if raw_y in ("1", "I"): target_year = "I Year"
                    elif raw_y in ("2", "II"): target_year = "II Year"
                    elif raw_y in ("3", "III"): target_year = "III Year"
                    elif raw_y in ("4", "IV"): target_year = "IV Year"
                    else: target_year = "III Year"
                    batch = s.batch

            # If student is IT, ensure department_id is IT
            if "IT" in reg or (s.department and s.department.code == "IT"):
                s.department_id = dept_it.id
                if target_year in it_counts:
                    it_counts[target_year] += 1
                else:
                    it_counts["Other"] += 1

            if s.year_level != target_year or s.batch != batch:
                s.year_level = target_year
                s.batch = batch
                updated_students += 1

            if target_year in year_counts:
                year_counts[target_year] += 1

        db.commit()
        print(f"[SUCCESS] Updated {updated_students} students with correct Year Level & Batch!")

        # 3. Synchronize all WeeklyPublicResult records across all sessions
        print("[INFO] Synchronizing WeeklyPublicResult year & dept values...")
        student_year_map = {s.id: (s.year_level, s.department.code if s.department else "CSE") for s in students}
        
        wpr_records = db.query(WeeklyPublicResult).all()
        wpr_updated = 0
        for wpr in wpr_records:
            if wpr.student_id in student_year_map:
                yr, dept = student_year_map[wpr.student_id]
                if wpr.year != yr or wpr.dept != dept:
                    wpr.year = yr
                    wpr.dept = dept
                    wpr_updated += 1

        db.commit()
        print(f"[SUCCESS] Synchronized {wpr_updated} WeeklyPublicResult records!")

        # 4. Clear all caches
        try:
            from backend.routes.weekly_contests import _CONTEST_RAM_CACHE
            _CONTEST_RAM_CACHE.clear()
        except Exception:
            pass

        try:
            cache.clear()
        except Exception:
            pass

        # 5. Print Summary Table
        print("\n" + "=" * 65)
        print("📊 FINAL DEPARTMENT & ACADEMIC YEAR BREAKDOWN:")
        print("=" * 65)

        results = db.query(Department.code, Student.year_level, func.count(Student.id))\
            .join(Department, Student.department_id == Department.id)\
            .filter(~Student.reg_no.like("REG_%"), ~Student.reg_no.like("TEST%"))\
            .group_by(Department.code, Student.year_level)\
            .order_by(Department.code, Student.year_level)\
            .all()

        for dept, yr, cnt in results:
            print(f"  * {dept:<10} | {yr or 'Not Set':<12} | {cnt} Students")

        print("=" * 65)
        print(f"  * IT Dept Split: II Year (25IT) = {it_counts['II Year']} | III Year (24IT) = {it_counts['III Year']}")
        print("=" * 65)
        print("[INFO] All web caches cleared. AWS Dashboard will reflect the updated year separation immediately!\n")

    except Exception as e:
        db.rollback()
        print(f"[FATAL ERROR] Failed to fix academic years: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    run_fix()
