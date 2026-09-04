import json
import os
from backend.database import SessionLocal
from backend.routes.students import get_students

def export_canonical_roster():
    db = SessionLocal()
    try:
        # Get all students with standard formatting
        students_res = get_students(limit=1000, sort_by="solved_desc", db=db)
        students_list = []
        for s in students_res:
            d = s.dict() if hasattr(s, "dict") else s
            # format dates to iso strings
            if d.get("stats") and d["stats"].get("last_verified_at"):
                if hasattr(d["stats"]["last_verified_at"], "isoformat"):
                    d["stats"]["last_verified_at"] = d["stats"]["last_verified_at"].isoformat()
            students_list.append(d)

        # Summary calculations
        total_students = len(students_list)
        verified_profiles = sum(1 for s in students_list if s.get("sync_state") == "SYNCED")
        pending_sync = sum(1 for s in students_list if s.get("sync_state") == "PENDING_USERNAME")
        failed_sync = sum(1 for s in students_list if s.get("sync_state") == "INVALID_USERNAME")

        summary = {
            "total_students": total_students,
            "total_solved_sum": sum(s.get("stats", {}).get("total_solved") or 0 for s in students_list if s.get("stats")),
            "active_contest_participants": sum(1 for s in students_list if s.get("contest_status") in ("PUBLIC_ATTENDED", "VIRTUAL_ATTENDED")),
            "current_session": {
                "id": 1,
                "contest_name": "Weekly Contest 515",
                "contest_number": 515,
                "session_name": "Weekly Contest 515 - Normal Session",
                "week_number": 33,
                "session_date": "16.08.2026",
                "start_time": "08:00",
                "end_time": "09:30",
                "status": "COMPLETED"
            },
            "next_session": {
                "id": 2,
                "contest_name": "Weekly Contest 516",
                "contest_number": 516,
                "session_name": "Weekly Contest 516 - Normal Session",
                "week_number": 34,
                "session_date": "23.08.2026",
                "start_time": "08:00",
                "end_time": "09:30",
                "status": "SCHEDULED"
            },
            "is_session_live": False,
            "session_phase": "SCHEDULED_NEXT_WEEK",
            "next_session_countdown_seconds": 223879,
            "verified_profiles": verified_profiles,
            "pending_sync": pending_sync,
            "failed_sync": failed_sync
        }

        content = f"""// Instant Database Cache for Zero-Latency First Paint
// Generated directly from database snapshot
export const CANONICAL_ROSTER: any[] = {json.dumps(students_list, indent=2, default=str)};

export const CANONICAL_SUMMARY: any = {json.dumps(summary, indent=2, default=str)};

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
      if (parsed && typeof parsed === 'object' && parsed.total_students) {{
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
        target_path = os.path.abspath(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "frontend", "src", "data", "canonicalRoster.ts"))
        with open(target_path, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Successfully generated {target_path} with {len(students_list)} students!")
    finally:
        db.close()

if __name__ == "__main__":
    export_canonical_roster()
