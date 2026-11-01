import sys
import os
import asyncio
import datetime

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from backend.database import SessionLocal
from backend.services.canonical_sync_pipeline import run_full_pipeline
from backend.ranking import update_all_rankings_and_badges
from backend.cache import cache

async def main():
    print(f"[{datetime.datetime.now().isoformat()}] Starting full canonical sync for all students...")
    db = SessionLocal()
    try:
        result = await run_full_pipeline(run_optional_phases=False)
        print(f"Sync pipeline finished. Result summary: {result}")
        print("Updating all rankings and badges...")
        update_all_rankings_and_badges(db)
        print("Clearing application caches...")
        cache.clear()
        print(f"[{datetime.datetime.now().isoformat()}] Full sync completed successfully!")
    except Exception as e:
        print(f"Sync failed with error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(main())

