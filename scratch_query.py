import sys
import os

sys.path.append(os.path.abspath('.'))

from backend.database import SessionLocal
from backend.models import WeeklySession, WeeklyPublicResult

db = SessionLocal()
session = db.query(WeeklySession).order_by(WeeklySession.id.desc()).first()

results = db.query(WeeklyPublicResult).filter(WeeklyPublicResult.session_id == session.id).all()
print(f"Total results: {len(results)}")

statuses = {}
for p in results:
    s = p.participation_status or "UNKNOWN"
    statuses[s] = statuses.get(s, 0) + 1
print(statuses)
