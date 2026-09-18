from backend.database import SessionLocal
from sqlalchemy import text
import pprint

db = SessionLocal()
res = db.execute(text("SELECT pid, state, wait_event_type, wait_event, query FROM pg_stat_activity WHERE datname = current_database() AND state != 'idle';"))
pprint.pprint(res.fetchall())
db.close()
