"""
import_fresh_students_dataset.py — Imports the 1,395 student dataset provided by user
"""

import os
import sys
import re
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.database import SessionLocal, engine
from backend.models import Student, Department, LeetCodeProfileStats, Section
from sqlalchemy import text
from backend.cache import cache


def parse_and_import(raw_tsv_path: str):
    db = SessionLocal()
    print(f"Reading student dataset from {raw_tsv_path}...")

    with open(raw_tsv_path, "r", encoding="utf-8") as f:
        lines = [line.strip() for line in f if line.strip()]

    # Ensure canonical departments exist
    canonical_depts = {
        "CSE": "Computer Science and Engineering",
        "CSE(CS)": "Computer Science and Engineering (Cyber Security)",
        "CSE(IOT)": "Computer Science and Engineering (IoT)",
        "IT": "Information Technology",
        "AIDS": "Artificial Intelligence and Data Science",
        "AIML": "Artificial Intelligence and Machine Learning",
        "ECE": "Electronics and Communication Engineering",
        "EEE": "Electrical and Electronics Engineering",
        "AGRI": "Agricultural Engineering",
        "MECH": "Mechanical Engineering",
        "CIVIL": "Civil Engineering",
        "BME": "Biomedical Engineering",
    }

    dept_objs = {}
    for code, name in canonical_depts.items():
        dept = db.query(Department).filter(Department.code == code).first()
        if not dept:
            dept = Department(code=code, name=name)
            db.add(dept)
            db.commit()
            db.refresh(dept)
        dept_objs[code] = dept

    # Clean student table before importing
    db.execute(text("PRAGMA foreign_keys = OFF;"))
    db.execute(text("DELETE FROM leetcode_profile_stats;"))
    db.execute(text("DELETE FROM students;"))
    db.execute(text("PRAGMA foreign_keys = ON;"))
    db.commit()

    imported_count = 0
    skipped_count = 0
    seen_reg_nos = set()

    for idx, line in enumerate(lines):
        parts = line.split("\t")
        if len(parts) < 4:
            continue
        if parts[0].lower() == "rank" or parts[1].lower() == "reg_no":
            continue

        rank_str = parts[0].strip()
        reg_no = parts[1].strip().upper()
        name = parts[2].strip()
        dept_code_raw = parts[3].strip().upper()
        batch_str = parts[4].strip() if len(parts) > 4 else "2028"
        profile_url = parts[5].strip() if len(parts) > 5 else ""
        username = parts[6].strip() if len(parts) > 6 else ""

        if not username and profile_url:
            # Extract username from URL if present
            m = re.search(r'leetcode\.com/u/([^/]+)', profile_url)
            if m:
                username = m.group(1).strip()

        if username.lower() in ("nill", "null", "none", "n/a", "problemset", "-"):
            username = ""

        if not reg_no or reg_no in seen_reg_nos:
            skipped_count += 1
            continue

        seen_reg_nos.add(reg_no)

        # Normalize Dept Code
        dept_code = dept_code_raw
        if dept_code in ["CS", "CSE(CS)", "CYBER SECURITY", "CYBER_SECURITY"]:
            dept_code = "CSE(CS)"
        elif dept_code in ["IOT", "CSE(IOT)", "INTERNET OF THINGS"]:
            dept_code = "CSE(IOT)"
        elif dept_code in ["AI&DS", "AI-DS", "AIDS"]:
            dept_code = "AIDS"
        elif dept_code in ["AI&ML", "AI-ML", "AIML"]:
            dept_code = "AIML"

        dept = dept_objs.get(dept_code)
        if not dept:
            dept = Department(code=dept_code, name=dept_code)
            db.add(dept)
            db.commit()
            db.refresh(dept)
            dept_objs[dept_code] = dept

        # Compute Year Level from Batch
        # Batch 2029 = I Year, Batch 2028 = II Year, Batch 2027 = III Year, Batch 2026 = IV Year
        year_level = "II"
        if "2029" in batch_str or "25" in batch_str:
            year_level = "I"
        elif "2028" in batch_str or "24" in batch_str:
            year_level = "II"
        elif "2027" in batch_str or "23" in batch_str:
            year_level = "III"
        elif "2026" in batch_str or "22" in batch_str:
            year_level = "IV"

        st = Student(
            reg_no=reg_no,
            name=name,
            department_id=dept.id,
            year_level=year_level,
            username=username if username else None,
            leetcode_url=f"https://leetcode.com/u/{username}/" if username else None,
            is_active=True
        )
        db.add(st)
        db.flush()

        stats = LeetCodeProfileStats(
            student_id=st.id,
            total_solved=0,
            easy_solved=0,
            medium_solved=0,
            hard_solved=0,
            status="pending" if username else "MISSING LINK",
            sync_status="not_started" if username else "pending_username"
        )
        db.add(stats)
        imported_count += 1

    db.commit()
    cache.clear()
    print(f"Successfully imported {imported_count} fresh students (Skipped duplicates/invalid: {skipped_count}).")

    # Generate canonicalRoster.ts
    generate_canonical_roster(db)
    db.close()


def generate_canonical_roster(db):
    from sqlalchemy import desc, nullslast
    from backend.models import LeetCodeProfileStats

    students = db.query(Student).outerjoin(
        LeetCodeProfileStats, Student.id == LeetCodeProfileStats.student_id
    ).order_by(
        nullslast(desc(LeetCodeProfileStats.total_solved)), Student.name.asc()
    ).all()

    roster_list = []
    total_problems_solved = 0
    active_solvers = 0
    top_ranker = "—"

    for rank, st in enumerate(students, 1):
        dept = st.department
        stats = st.stats

        t_solved = stats.total_solved if stats and stats.total_solved is not None else 0
        e_solved = stats.easy_solved if stats and stats.easy_solved is not None else 0
        m_solved = stats.medium_solved if stats and stats.medium_solved is not None else 0
        h_solved = stats.hard_solved if stats and stats.hard_solved is not None else 0
        c_rating = stats.contest_rating if stats else None
        s_status = stats.sync_status if stats else ("not_started" if st.username else "pending_username")
        v_status = stats.status if stats else ("pending" if st.username else "MISSING LINK")
        l_verified = stats.last_verified_at.isoformat() if stats and stats.last_verified_at else None

        if t_solved > 0:
            active_solvers += 1
            total_problems_solved += t_solved
            if top_ranker == "—":
                top_ranker = st.name

        roster_list.append({
            "id": st.id,
            "name": st.name,
            "reg_no": st.reg_no,
            "username": st.username,
            "year_level": st.year_level,
            "department_id": st.department_id,
            "department": {
                "id": dept.id,
                "name": dept.name,
                "code": dept.code
            } if dept else None,
            "sync_state": "SYNCED" if t_solved > 0 else "PENDING_SYNC",
            "profile_url": st.leetcode_url,
            "stats": {
                "total_solved": t_solved,
                "easy_solved": e_solved,
                "medium_solved": m_solved,
                "hard_solved": h_solved,
                "contest_rating": c_rating,
                "sync_status": s_status,
                "status": v_status,
                "last_verified_at": l_verified,
            },
            "streak_count": stats.max_streak if stats and stats.max_streak else 0,
            "college_rank": rank,
            "dept_rank": rank,
            "weekly_progress": t_solved,
            "contest_status": "ATTENDED" if t_solved > 0 else "NOT_ATTENDED",
            "contest_solved": 0,
            "contest_score_display": "0 / 4",
            "contest_name": "Weekly Contest 516",
            "contest_number": 516,
            "has_virtual": False,
        })

    summary_obj = {
        "total_students": len(roster_list),
        "total_solved_sum": total_problems_solved,
        "total_problems_solved": total_problems_solved,
        "active_students": active_solvers,
        "active_solvers": active_solvers,
        "verified_profiles": active_solvers,
        "pending_sync": max(0, len(roster_list) - active_solvers),
        "failed_sync": 0,
        "top_college_ranker": top_ranker,
        "current_session": {
            "id": 1,
            "contest_name": "Weekly Contest 516",
            "contest_number": 516,
            "session_name": "Weekly Contest 516 - Live Session",
            "status": "SCHEDULED"
        },
        "is_session_live": False,
        "session_phase": "SCHEDULED_NEXT_WEEK",
        "next_session_countdown_seconds": 86400
    }

    target_file = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
        "frontend", "src", "data", "canonicalRoster.ts"
    )

    code_content = f"""// Instant Database Cache for Zero-Latency First Paint
// Generated directly from fresh database snapshot ({len(roster_list)} students)
export const CANONICAL_ROSTER: any[] = {json.dumps(roster_list, ensure_ascii=False, indent=2)};

export const CANONICAL_SUMMARY: any = {json.dumps(summary_obj, ensure_ascii=False, indent=2)};

export function getCachedStudents(): any[] {{
  if (typeof window === 'undefined') return CANONICAL_ROSTER;
  try {{
    const cached = localStorage.getItem('nec_cached_students');
    if (cached) {{
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {{
        return parsed;
      }}
    }}
  }} catch (e) {{
    console.warn('Could not read cached students:', e);
  }}
  return CANONICAL_ROSTER;
}}

export function saveCachedStudents(students: any[]): void {{
  if (typeof window === 'undefined' || !Array.isArray(students) || students.length === 0) return;
  try {{
    localStorage.setItem('nec_cached_students', JSON.stringify(students));
    localStorage.setItem('nec_cached_students_timestamp', new Date().toISOString());
  }} catch (e) {{
    console.warn('Could not save cached students to localStorage:', e);
  }}
}}

export function invalidateStudentCache(): void {{
  if (typeof window === 'undefined') return;
  try {{
    localStorage.removeItem('nec_cached_students');
    localStorage.removeItem('nec_cached_students_timestamp');
    localStorage.removeItem('nec_cached_summary');
  }} catch (e) {{
    console.warn('Could not invalidate cached students in localStorage:', e);
  }}
}}

export function getCachedSummary(): any {{
  if (typeof window === 'undefined') return CANONICAL_SUMMARY;
  try {{
    const cached = localStorage.getItem('nec_cached_summary');
    if (cached) {{
      const parsed = JSON.parse(cached);
      if (parsed && typeof parsed === 'object') {{
        return parsed;
      }}
    }}
  }} catch (e) {{
    console.warn('Could not read cached summary:', e);
  }}
  return CANONICAL_SUMMARY;
}}

export function saveCachedSummary(summary: any): void {{
  if (typeof window === 'undefined' || !summary) return;
  try {{
    localStorage.setItem('nec_cached_summary', JSON.stringify(summary));
    localStorage.setItem('nec_cached_summary_timestamp', new Date().toISOString());
  }} catch (e) {{
    console.warn('Could not save cached summary to localStorage:', e);
  }}
}}

export function getCanonicalSummary() {{
  return getCachedSummary();
}}
"""

    with open(target_file, "w", encoding="utf-8") as f:
        f.write(code_content)

    print(f"Successfully generated {target_file} with {len(roster_list)} students.")


if __name__ == "__main__":
    tsv_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
        "data", "fresh_imported_students.tsv"
    )
    if len(sys.argv) > 1:
        tsv_path = sys.argv[1]
    parse_and_import(tsv_path)
