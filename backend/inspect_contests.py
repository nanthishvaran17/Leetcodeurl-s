from backend.database import SessionLocal
from backend.models import WeeklySession, WeeklyPublicResult, WeeklyVirtualResult, Student
from backend.routes.weekly_contests import get_session_matrix

db = SessionLocal()
sessions = db.query(WeeklySession).all()
print(f"Total Sessions: {len(sessions)}")
for s in sessions:
    res = get_session_matrix(session_id=s.id, dept=None, year=None, attendance=None, db=db, current_user={"role": "admin"})
    attended = [r for r in res["rows"] if r["status"] in ("PUBLIC", "VIRTUAL")]
    print(f"Session {s.id} ({s.contest_name}): Total Rows={len(res['rows'])}, Attended={len(attended)}, Metrics={res['metrics']}")
