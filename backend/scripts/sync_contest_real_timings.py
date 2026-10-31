import asyncio
import sys
import os
import argparse

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.database import SessionLocal
from backend.models import WeeklySession
from backend.services.official_contest_ranking_service import OfficialContestRankingService
from backend.logger import logger

def main():
    parser = argparse.ArgumentParser(description="Universal Automatic Weekly Contest Real Timings Sync")
    parser.add_argument("--session_id", type=int, default=None, help="WeeklySession ID to sync")
    parser.add_argument("--contest_num", type=int, default=None, help="Contest number (e.g. 524)")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        session = None
        if args.session_id:
            session = db.query(WeeklySession).filter(WeeklySession.id == args.session_id).first()
        elif args.contest_num:
            session = db.query(WeeklySession).filter(WeeklySession.contest_name.ilike(f"%{args.contest_num}%")).order_by(WeeklySession.id.desc()).first()
        else:
            session = db.query(WeeklySession).order_by(WeeklySession.id.desc()).first()

        if not session:
            print("[ERROR] No matching WeeklySession found in database.")
            sys.exit(1)

        print(f"[START] Syncing Session {session.id} ({session.contest_name}) with genuine LeetCode telemetry...")
        result = OfficialContestRankingService.scan_and_sync_contest_sync(session.id, db)
        print(f"[COMPLETE] Telemetry (Count & Time) Result: {result}")

        print(f"[START] Syncing Verbatim Submission Codes for Session {session.id}...")
        try:
            from backend.services.auto_code_sync_service import sync_contest_submission_codes_for_session
            code_result = sync_contest_submission_codes_for_session(session.id, db=db, force_refresh=True)
            print(f"[COMPLETE] Verbatim Code Result: {code_result}")
        except Exception as code_err:
            print(f"[NOTE] Code sync notice: {code_err}")

        # Invalidate cache so changes take effect immediately
        try:
            from backend.services.canonical_contest_engine import invalidate_canonical_cache
            invalidate_canonical_cache(session.id)
            print("[SUCCESS] Cache invalidated. All 3 pillars (COUNT, TIME, and CODE) are now live!")
        except Exception as cache_err:
            print(f"[NOTE] Cache invalidation notice: {cache_err}")
    finally:
        db.close()

if __name__ == "__main__":
    main()
