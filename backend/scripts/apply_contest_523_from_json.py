"""
apply_contest_523_from_json.py
================================
Reads contest_523_solver_map.json (official LeetCode Contest 523 rankings)
and updates student records in DB.

Usage:
  python backend/scripts/apply_contest_523_from_json.py
  python backend/scripts/apply_contest_523_from_json.py --session-id 28
"""

import sys
import os
import json
import argparse

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from backend.database import SessionLocal, engine
from backend.models import Student, WeeklySession, WeeklyPublicResult, PreviousWeekParticipationRecord

# Configure sqlite timeout and WAL mode to prevent 'database is locked' errors
if "sqlite" in str(engine.url):
    with engine.connect() as conn:
        try:
            conn.exec_driver_sql("PRAGMA journal_mode=WAL;")
            conn.exec_driver_sql("PRAGMA busy_timeout=60000;")
        except Exception:
            pass

CONTEST_NUMBER = 523
JSON_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "contest_523_solver_map.json")


def apply_solver_map():
    parser = argparse.ArgumentParser()
    parser.add_argument("--session-id", type=int, default=None)
    args, _ = parser.parse_known_args()

    if not os.path.exists(JSON_PATH):
        print(f"[ERROR] JSON file not found: {JSON_PATH}")
        return

    with open(JSON_PATH, "r", encoding="utf-8") as f:
        solver_map = json.load(f)

    print(f"[INFO] Loaded solver map with {len(solver_map)} student entries")

    db = SessionLocal()
    try:
        session = None
        if args.session_id:
            session = db.query(WeeklySession).filter(WeeklySession.id == args.session_id).first()

        if not session:
            session = db.query(WeeklySession).filter(
                (WeeklySession.contest_name.ilike(f"%{CONTEST_NUMBER}%")) |
                (WeeklySession.contest_id.ilike(f"%{CONTEST_NUMBER}%")) |
                (WeeklySession.id == 28)
            ).first()

        if not session:
            print(f"[ERROR] Session for Contest {CONTEST_NUMBER} not found in DB!")
            return

        print(f"[INFO] Target session: '{session.contest_name}' (ID: {session.id})")

        students = db.query(Student).filter(
            Student.is_active == True,
            Student.username.isnot(None)
        ).all()

        print(f"[INFO] Checking {len(students)} active students against solver map...")

        matched = 0
        not_in_ranking = 0

        for st in students:
            uname_lower = (st.username or "").strip().lower()
            if not uname_lower:
                continue

            data = solver_map.get(uname_lower)
            if not data:
                not_in_ranking += 1
                continue

            # Update WeeklyPublicResult
            wpr = db.query(WeeklyPublicResult).filter(
                WeeklyPublicResult.session_id == session.id,
                WeeklyPublicResult.student_id == st.id
            ).first()

            if not wpr:
                wpr = WeeklyPublicResult(
                    session_id=session.id,
                    student_id=st.id,
                    participation_status=data.get("participation_status", "PUBLIC_ATTENDED"),
                    q1=data.get("q1", 0),
                    q2=data.get("q2", 0),
                    q3=data.get("q3", 0),
                    q4=data.get("q4", 0),
                    total_contest_solved=data.get("total_solved", 0),
                    contest_score=data.get("score") or 0,
                    contest_rank=data.get("rank"),
                    confidence="VERIFIED",
                    fetch_status="SUCCESS"
                )
                db.add(wpr)
            else:
                wpr.q1 = data.get("q1", 0)
                wpr.q2 = data.get("q2", 0)
                wpr.q3 = data.get("q3", 0)
                wpr.q4 = data.get("q4", 0)
                wpr.total_contest_solved = data.get("total_solved", 0)
                if data.get("score") is not None:
                    wpr.contest_score = data["score"]
                if data.get("rank") is not None:
                    wpr.contest_rank = data["rank"]
                wpr.participation_status = data.get("participation_status", "PUBLIC_ATTENDED")
                wpr.confidence = "VERIFIED"
                wpr.fetch_status = "SUCCESS"

            # Also update PreviousWeekParticipationRecord if present
            pwpr = db.query(PreviousWeekParticipationRecord).filter(
                PreviousWeekParticipationRecord.session_id == session.id,
                PreviousWeekParticipationRecord.student_id == st.id
            ).first()

            if pwpr:
                pwpr.q1 = data.get("q1", 0)
                pwpr.q2 = data.get("q2", 0)
                pwpr.q3 = data.get("q3", 0)
                pwpr.q4 = data.get("q4", 0)
                pwpr.problems_solved = data.get("total_solved", 0)
                if data.get("score") is not None:
                    pwpr.official_score = data["score"]
                if data.get("rank") is not None:
                    pwpr.official_rank = data["rank"]
                pwpr.participation_type = "PUBLIC"
                pwpr.verification_status = "VERIFIED"

            matched += 1

        db.commit()

        # Invalidate caches
        try:
            from backend.cache import cache
            cache.clear()
            print("[INFO] Application cache cleared")
        except Exception:
            pass

        try:
            from backend.services.canonical_contest_engine import invalidate_canonical_cache
            invalidate_canonical_cache(session.id)
            print("[INFO] Canonical cache invalidated")
        except Exception:
            pass

        print(f"\n{'='*70}")
        print(f"DATABASE UPDATE COMPLETE!")
        print(f"  Matched & updated: {matched} students")
        print(f"  Not in solver map: {not_in_ranking} students")
        print(f"{'='*70}")

    finally:
        db.close()


if __name__ == "__main__":
    apply_solver_map()
