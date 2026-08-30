import sys
import os

sys.path.append(os.path.abspath('.'))

from backend.database import SessionLocal
from backend.models import WeeklySession, WeeklyPublicResult

db = SessionLocal()
results = db.query(WeeklyPublicResult).filter(WeeklyPublicResult.session_id == 3).all()

statuses = {}
for p in results:
    s = p.participation_status or "UNKNOWN"
    statuses[s] = statuses.get(s, 0) + 1

print("Session 3 Statuses:", statuses)

# How many have solved > 0
solved_counts = {}
for p in results:
    solved = p.q1 + p.q2 + p.q3 + p.q4
    s = p.participation_status or "UNKNOWN"
    if solved > 0:
        solved_counts[s] = solved_counts.get(s, 0) + 1

print("Solved > 0 by status:", solved_counts)

