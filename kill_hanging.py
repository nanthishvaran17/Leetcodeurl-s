from backend.database import SessionLocal
from sqlalchemy import text
db = SessionLocal()
db.execute(text("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = current_database() AND pid != pg_backend_pid() AND state = 'idle in transaction';"))
db.commit()
print("Terminated hanging transactions")
