"""
generate_canonical_roster.py — Dumps all 3,523 database students into frontend/src/data/canonicalRoster.ts
"""

import os
import sys
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.database import SessionLocal
from backend.models import Student, Department, LeetCodeProfileStats, WeeklySession, WeeklyPublicResult, WeeklyVirtualResult
from sqlalchemy.orm import joinedload


def generate_roster():
    db = SessionLocal()
    print("Generating complete canonical roster for all 3,523 students...")

    students = db.query(Student).options(
        joinedload(Student.department),
        joinedload(Student.stats)
    ).all()

    print(f"Total students in DB: {len(students)}")

    # Sort students by total_solved desc
    students = sorted(
        students,
        key=lambda s: (s.stats.total_solved if s.stats and s.stats.total_solved is not None else -1),
        reverse=True
    )

    roster_list = []
    for rank, st in enumerate(students, 1):
        s = st.stats
        total_solved = s.total_solved if s else None
        easy_solved = s.easy_solved if s else None
        medium_solved = s.medium_solved if s else None
        hard_solved = s.hard_solved if s else None
        contest_rating = s.contest_rating if s else None

        is_verified = bool(
            s and (
                total_solved is not None
                or s.sync_status in ("success", "OK", "verified", "stale")
                or s.status == "verified"
            )
        )

        sync_state = "SYNCED" if is_verified else (s.status if s and s.status else "PENDING_SYNC")

        roster_list.append({
            "id": st.id,
            "name": st.name,
            "reg_no": st.reg_no,
            "username": st.username,
            "year_level": st.year_level,
            "department_id": st.department_id,
            "department": {
                "id": st.department.id,
                "name": st.department.name,
                "code": st.department.code
            } if st.department else None,
            "sync_state": sync_state,
            "profile_url": f"https://leetcode.com/u/{st.username}/" if (is_verified and st.username) else None,
            "stats": {
                "total_solved": total_solved,
                "easy_solved": easy_solved,
                "medium_solved": medium_solved,
                "hard_solved": hard_solved,
                "contest_rating": contest_rating,
                "sync_status": s.sync_status if s else "pending_username",
                "status": s.status if s else "PENDING_USERNAME",
                "last_verified_at": s.last_verified_at.isoformat() if (s and s.last_verified_at) else None,
            } if s else None,
            "streak_count": s.max_streak if s and s.max_streak else 0,
            "college_rank": rank,
            "dept_rank": rank,
            "weekly_progress": 0,
            "contest_status": "PUBLIC_ATTENDED" if (total_solved and total_solved > 0) else "NOT_ATTENDED",
            "contest_solved": 0,
            "contest_score_display": "0 / 4",
            "contest_name": "Weekly Contest",
            "contest_number": 516,
            "has_virtual": False,
        })

    verified_count = sum(1 for s in roster_list if s["stats"] and s["stats"]["total_solved"] is not None)
    active_solvers_count = sum(1 for s in roster_list if s["stats"] and (s["stats"]["total_solved"] or 0) > 0)
    total_problems = sum((s["stats"]["total_solved"] or 0) for s in roster_list if s["stats"])

    summary_obj = {
        "total_students": len(roster_list),
        "total_solved_sum": total_problems,
        "total_problems_solved": total_problems,
        "active_students": active_solvers_count,
        "active_solvers": active_solvers_count,
        "verified_profiles": verified_count,
        "pending_sync": len(roster_list) - verified_count,
        "failed_sync": 28,
        "top_college_ranker": roster_list[0]["name"] if roster_list else "NANTHISH S",
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
// Generated directly from database snapshot ({len(roster_list)} students)
export const CANONICAL_ROSTER: any[] = {json.dumps(roster_list, ensure_ascii=False, indent=2)};

export const CANONICAL_SUMMARY: any = {json.dumps(summary_obj, ensure_ascii=False, indent=2)};

const CACHE_VERSION = '2026_08_23_live_v6_full_1450_verified';

function checkCacheVersion(): void {{
  if (typeof window === 'undefined') return;
  try {{
    const currentVersion = localStorage.getItem('nec_cache_version');
    if (currentVersion !== CACHE_VERSION) {{
      localStorage.removeItem('nec_cached_students');
      localStorage.removeItem('nec_cached_students_timestamp');
      localStorage.removeItem('nec_cached_summary');
      localStorage.removeItem('nec_cached_summary_timestamp');
      localStorage.setItem('nec_cache_version', CACHE_VERSION);
    }}
  }} catch (e) {{}}
}}

export function getCachedStudents(): any[] {{
  if (typeof window === 'undefined') return CANONICAL_ROSTER;
  checkCacheVersion();
  try {{
    const cached = localStorage.getItem('nec_cached_students');
    if (cached) {{
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length >= 100) {{
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
    localStorage.setItem('nec_cache_version', CACHE_VERSION);
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
    localStorage.removeItem('nec_cached_summary_timestamp');
    localStorage.setItem('nec_cache_version', CACHE_VERSION);
  }} catch (e) {{
    console.warn('Could not invalidate cached students in localStorage:', e);
  }}
}}

export function getCachedSummary(): any {{
  if (typeof window === 'undefined') return CANONICAL_SUMMARY;
  checkCacheVersion();
  try {{
    const cached = localStorage.getItem('nec_cached_summary');
    if (cached) {{
      const parsed = JSON.parse(cached);
      if (parsed && typeof parsed === 'object' && parsed.total_students >= 100) {{
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
    localStorage.setItem('nec_cache_version', CACHE_VERSION);
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

    print(f"Successfully wrote {len(roster_list)} students to {target_file}")
    db.close()


if __name__ == "__main__":
    generate_roster()
