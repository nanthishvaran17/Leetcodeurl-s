"""
wipe_all_student_data.py — Safely purges all student records and related stats/contests
while preserving users, admin accounts, departments, and system structure.
"""

import os
import sys
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.database import SessionLocal, engine
from sqlalchemy import text
from backend.cache import cache


def wipe_students():
    print("Preparing to wipe all student records...")
    db = SessionLocal()
    try:
        tables_to_clear = [
            "faculty_action_audit_logs",
            "faculty_student_assignments",
            "weekly_public_results",
            "weekly_virtual_results",
            "weekly_student_progress",
            "weekly_session_snapshots",
            "student_stat_snapshots",
            "contest_participations",
            "student_contest_snapshots",
            "student_contest_participations",
            "mentor_notes",
            "student_risk_profiles",
            "certificates",
            "leetcode_profile_stats",
            "students"
        ]

        db.execute(text("PRAGMA foreign_keys = OFF;"))
        for table in tables_to_clear:
            try:
                db.execute(text(f"DELETE FROM {table};"))
                print(f"  Cleared table: {table}")
            except Exception as ex:
                print(f"  Notice on {table}: {ex}")
        db.execute(text("PRAGMA foreign_keys = ON;"))

        db.commit()
        cache.clear()
        print("Successfully wiped all student data from database.")

        # Reset canonicalRoster.ts to empty roster
        target_file = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
            "frontend", "src", "data", "canonicalRoster.ts"
        )

        empty_summary = {
            "total_students": 0,
            "total_solved_sum": 0,
            "total_problems_solved": 0,
            "active_students": 0,
            "active_solvers": 0,
            "verified_profiles": 0,
            "pending_sync": 0,
            "failed_sync": 0,
            "top_college_ranker": "N/A",
            "current_session": {
                "id": 1,
                "contest_name": "Weekly Contest",
                "session_name": "Weekly Contest - Normal Session",
                "status": "SCHEDULED"
            },
            "is_session_live": False,
            "session_phase": "SCHEDULED",
            "next_session_countdown_seconds": 86400
        }

        empty_content = f"""// Instant Database Cache for Zero-Latency First Paint
// Reset: Ready for fresh student roster import
export const CANONICAL_ROSTER: any[] = [];

export const CANONICAL_SUMMARY: any = {json.dumps(empty_summary, ensure_ascii=False, indent=2)};

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
  if (typeof window === 'undefined' || !Array.isArray(students)) return;
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
            f.write(empty_content)
        print(f"Reset {target_file} to clean empty state.")

    except Exception as e:
        db.rollback()
        print(f"Error wiping students: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    wipe_students()
