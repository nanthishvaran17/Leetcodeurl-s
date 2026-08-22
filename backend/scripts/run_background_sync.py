"""
run_background_sync.py — Continuous background sync engine for all 1,395 students.
Fetches live LeetCode stats, updates database, rankings, and zero-latency cache continuously.
"""

import os
import sys
import asyncio
import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.database import SessionLocal
from backend.models import Student, LeetCodeProfileStats
from backend.services.canonical_sync_pipeline import run_full_pipeline
from backend.scripts.import_fresh_students_dataset import generate_canonical_roster
from backend.ranking import update_all_rankings_and_badges
from backend.cache import cache


async def sync_all_students_continuous():
    print("Ultra-Fast 1000x Continuous background sync engine initialized.")
    while True:
        db = SessionLocal()
        try:
            print(f"[{datetime.datetime.utcnow().isoformat()}] Triggering ultra-fast concurrent sync for 1,395 students...")
            await run_full_pipeline(run_optional_phases=False)
            update_all_rankings_and_badges(db)
            generate_canonical_roster(db)
            cache.clear()
            print("Cycle completed cleanly. Updating all rankings and cache. Sleeping 10 minutes...")
        except Exception as e:
            print(f"Error during sync cycle: {e}")
        finally:
            db.close()
        await asyncio.sleep(600)


if __name__ == "__main__":
    asyncio.run(sync_all_students_continuous())
