import json
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from backend.database import SessionLocal
from backend.models import Student, WeeklySession, WeeklyPublicResult

def export_from_local_db():
    db = SessionLocal()
    try:
        session = db.query(WeeklySession).filter(
            WeeklySession.contest_name.ilike("%523%")
        ).first()
        if not session:
            print("Session for Contest 523 not found in local DB!")
            return

        print(f"Found session: {session.contest_name} (ID: {session.id})")
        
        results = db.query(WeeklyPublicResult, Student).join(
            Student, Student.id == WeeklyPublicResult.student_id
        ).filter(
            WeeklyPublicResult.session_id == session.id
        ).all()
        
        print(f"Total WeeklyPublicResult records for session: {len(results)}")
        
        solver_map = {}
        attended_count = 0
        for wpr, st in results:
            uname = (st.username or "").strip().lower()
            if not uname:
                continue
            
            # Check if this student has participated or has solves
            record = {
                "q1": wpr.q1 or 0,
                "q2": wpr.q2 or 0,
                "q3": wpr.q3 or 0,
                "q4": wpr.q4 or 0,
                "total_solved": (wpr.q1 or 0) + (wpr.q2 or 0) + (wpr.q3 or 0) + (wpr.q4 or 0),
                "rank": wpr.contest_rank,
                "score": wpr.contest_score,
                "participation_status": wpr.participation_status
            }
            if wpr.participation_status == "PUBLIC_ATTENDED" or record["rank"] is not None:
                attended_count += 1
            solver_map[uname] = record

        out_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "contest_523_solver_map.json")
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(solver_map, f, ensure_ascii=False, indent=2)
            
        print(f"Successfully exported {len(solver_map)} student records ({attended_count} attended) to {out_path}")
    finally:
        db.close()

if __name__ == "__main__":
    export_from_local_db()
