import asyncio
from backend.database import SessionLocal
from backend.routes.weekly_contests import _run_sync_in_background

async def main():
    print('Starting full sync for session 2...')
    await _run_sync_in_background(2)
    print('Full sync complete!')

asyncio.run(main())
