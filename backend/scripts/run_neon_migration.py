import os
import sys
import json
import sqlite3
from sqlalchemy import create_engine, MetaData, text, inspect

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, ROOT_DIR)

from backend.models import Base

SQLITE_PATH = os.path.join(ROOT_DIR, "data", "leetcode_tracker.db")
PG_URL = "postgresql://neondb_owner:npg_5oAmt0ICFKMT@ep-falling-pine-ae9dk8zu.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"

def main():
    print(f"Connecting to SQLite source: {SQLITE_PATH} ({os.path.getsize(SQLITE_PATH):,} bytes)...", flush=True)
    sqlite_conn = sqlite3.connect(SQLITE_PATH)
    cursor = sqlite_conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")
    tables = [r[0] for r in cursor.fetchall()]
    
    source_counts = {}
    for t in tables:
        cursor.execute(f'SELECT COUNT(*) FROM "{t}"')
        source_counts[t] = cursor.fetchone()[0]
    
    print(f"Found {len(tables)} tables in SQLite. Total Students: {source_counts.get('students', 0)}", flush=True)

    print("Connecting to Neon PostgreSQL...", flush=True)
    engine = create_engine(PG_URL, echo=False, pool_pre_ping=True)
    
    print("Ensuring PostgreSQL tables exist...", flush=True)
    Base.metadata.create_all(bind=engine)
    print("Tables ensured!", flush=True)

    target_metadata = MetaData()
    target_metadata.reflect(bind=engine)

    sqlite_conn.row_factory = sqlite3.Row
    sqlite_cursor = sqlite_conn.cursor()

    total_inserted = 0
    with engine.connect() as pg_conn:
        for t_name in tables:
            count = source_counts.get(t_name, 0)
            if count == 0:
                continue
            if t_name not in target_metadata.tables:
                print(f"Skipping table {t_name} (not in ORM models)", flush=True)
                continue

            target_table = target_metadata.tables[t_name]
            target_cols = {c.name for c in target_table.columns}

            sqlite_cursor.execute(f'SELECT * FROM "{t_name}"')
            rows = sqlite_cursor.fetchall()

            batch = []
            for r in rows:
                row_dict = dict(r)
                filtered = {k: v for k, v in row_dict.items() if k in target_cols}
                for k, v in filtered.items():
                    if isinstance(v, str) and (v.startswith("{") or v.startswith("[")):
                        try:
                            filtered[k] = json.loads(v)
                        except Exception:
                            pass
                batch.append(filtered)

            chunk_size = 500
            for i in range(0, len(batch), chunk_size):
                chunk = batch[i:i + chunk_size]
                try:
                    pg_conn.execute(target_table.insert(), chunk)
                    pg_conn.commit()
                except Exception as ex:
                    pg_conn.rollback()
                    for single_r in chunk:
                        try:
                            pg_conn.execute(target_table.insert().values(**single_r))
                            pg_conn.commit()
                        except Exception:
                            pg_conn.rollback()

            total_inserted += len(batch)
            print(f"[MIGRATED] {t_name:<35}: {len(batch):>6} rows", flush=True)

    sqlite_conn.close()
    print(f"MIGRATION COMPLETE! Total rows migrated: {total_inserted:,}", flush=True)

if __name__ == "__main__":
    main()
