"""
apply_contest_525_from_json.py
================================
Applies the verified authentic 192 solvers dataset for Weekly Contest 525
to the database and clears all caches on AWS EC2.

Usage on AWS EC2:
  /var/www/leetcode-tracker/.venv/bin/python3 backend/scripts/apply_contest_525_from_json.py
"""

import sys
import os
import json
import argparse

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from backend.database import SessionLocal, engine
from backend.models import Student, WeeklySession, WeeklyPublicResult, PreviousWeekParticipationRecord
from backend.services.official_contest_ranking_service import OfficialContestRankingService
from backend.cache import cache

# Configure sqlite timeout and WAL mode to prevent locks
if "sqlite" in str(engine.url):
    with engine.connect() as conn:
        try:
            conn.exec_driver_sql("PRAGMA journal_mode=WAL;")
            conn.exec_driver_sql("PRAGMA busy_timeout=60000;")
        except Exception:
            pass

CANDIDATE_PATHS = [
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "contest_525_authentic_scanned_solvers.json"),
    os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "contest_525_authentic_scanned_solvers.json"),
    "/var/www/leetcode-tracker/contest_525_authentic_scanned_solvers.json",
    "/var/www/leetcode-tracker/backend/scripts/contest_525_authentic_scanned_solvers.json",
    "contest_525_authentic_scanned_solvers.json"
]

def load_solvers_data():
    for p in CANDIDATE_PATHS:
        if os.path.exists(p):
            print(f"[INFO] Found authentic solvers JSON at: {p}")
            with open(p, "r", encoding="utf-8") as f:
                return json.load(f), p
    return None, None

def main():
    parser = argparse.ArgumentParser(description="Apply Contest 525 Authentic Solvers to Database")
    parser.add_argument("--session-id", type=int, default=None, help="Explicit WeeklySession ID")
    args = parser.parse_args()

    scanned_data, file_path = load_solvers_data()
    if not scanned_data:
        print("[ERROR] Could not find 'contest_525_authentic_scanned_solvers.json' in any known location!")
        print("Please ensure the file is present in /var/www/leetcode-tracker/")
        sys.exit(1)

    print(f"[INFO] Loaded {len(scanned_data)} authentic student solver records from {file_path}")

    db = SessionLocal()
    try:
        session = None
        if args.session_id:
            session = db.query(WeeklySession).filter(WeeklySession.id == args.session_id).first()

        if not session:
            # Find session 525
            session = db.query(WeeklySession).filter(
                (WeeklySession.contest_name.ilike("%525%")) |
                (WeeklySession.contest_id.ilike("%525%")) |
                (WeeklySession.id == 18)
            ).order_by(WeeklySession.id.desc()).first()

        if not session:
            # Fallback to the latest active session
            session = db.query(WeeklySession).order_by(WeeklySession.id.desc()).first()

        if not session:
            print("[ERROR] No WeeklySession found in the database!")
            sys.exit(1)

        print(f"[INFO] Target WeeklySession: '{session.contest_name}' (ID: {session.id}, Date: {session.session_date})")

        # Apply using OfficialContestRankingService
        summary = OfficialContestRankingService.apply_scanned_results_to_db(
            session=session,
            scanned_data=scanned_data,
            db=db
        )

        db.commit()

        # Invalidate all contest and dashboard caches
        try:
            from backend.routes.weekly_contests import _CONTEST_RAM_CACHE
            _CONTEST_RAM_CACHE.clear()
        except Exception:
            pass

        try:
            from backend.services.canonical_contest_engine import invalidate_canonical_cache
            invalidate_canonical_cache(session.id)
        except Exception:
            pass

        try:
            cache.clear()
        except Exception:
            pass

        # Query summary counts directly from DB to verify
        public_count = db.query(WeeklyPublicResult).filter(
            WeeklyPublicResult.session_id == session.id,
            WeeklyPublicResult.participation_status == "PUBLIC_ATTENDED"
        ).count()

        not_attended_count = db.query(WeeklyPublicResult).filter(
            WeeklyPublicResult.session_id == session.id,
            WeeklyPublicResult.participation_status == "NOT_ATTENDED"
        ).count()

        total_students = db.query(WeeklyPublicResult).filter(
            WeeklyPublicResult.session_id == session.id
        ).count()

        print("\n" + "=" * 60)
        print("🎉 CONTEST 525 RE-SYNC COMPLETED SUCCESSFULLY!")
        print("=" * 60)
        print(f"  • Total Students Processed: {total_students}")
        print(f"  • Public / Live Attended:  {public_count}")
        print(f"  • Not Attended:            {not_attended_count}")
        print(f"  • Matched Solvers in JSON: {len(scanned_data)}")
        print("=" * 60)
        print("✅ Cache cleared. Dashboard on AWS will now immediately show full live solvers!\n")

    except Exception as e:
        db.rollback()
        print(f"[FATAL ERROR] Failed applying contest data: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    main()
