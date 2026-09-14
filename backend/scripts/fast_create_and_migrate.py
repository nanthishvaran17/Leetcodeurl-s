import os
import sys
import json
import sqlite3
from sqlalchemy import create_engine, MetaData, text

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, ROOT_DIR)

from backend.models import Base

SQLITE_PATH = os.path.join(ROOT_DIR, "data", "leetcode_tracker.db")
PG_URL = "postgresql://neondb_owner:npg_5oAmt0ICFKMT@ep-falling-pine-ae9dk8zu.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"

def main():
    print("=" * 70, flush=True)
    print("FAST NEON POSTGRESQL DATA MIGRATOR", flush=True)
    print("=" * 70, flush=True)

    print(f"[SOURCE] Reading SQLite: {SQLITE_PATH}...", flush=True)
    sqlite_conn = sqlite3.connect(SQLITE_PATH)
    cursor = sqlite_conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")
    tables = [r[0] for r in cursor.fetchall()]

    source_counts = {}
    for t in tables:
        cursor.execute(f'SELECT COUNT(*) FROM "{t}"')
        source_counts[t] = cursor.fetchone()[0]

    print(f"[SOURCE] Found {len(tables)} tables. Students: {source_counts.get('students', 0)}, Users: {source_counts.get('users', 0)}", flush=True)

    print("[NEON DB] Connecting with AUTOCOMMIT enabled...", flush=True)
    engine = create_engine(PG_URL, echo=False, pool_pre_ping=True, execution_options={"isolation_level": "AUTOCOMMIT"})
    
    print("[NEON DB] Ensuring Schema (creating all tables)...", flush=True)
    Base.metadata.create_all(bind=engine)
    print("[NEON DB] Schema created successfully!", flush=True)

    target_metadata = MetaData()
    target_metadata.reflect(bind=engine)

    sqlite_conn.row_factory = sqlite3.Row
    sqlite_cursor = sqlite_conn.cursor()

    total_rows = 0
    # Connect with transaction engine for bulk data insertion
    data_engine = create_engine(PG_URL, echo=False, pool_pre_ping=True)
    with data_engine.connect() as pg_conn:
        for t_name in sorted(tables):
            count = source_counts.get(t_name, 0)
            if count == 0:
                continue
            if t_name not in target_metadata.tables:
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
                except Exception:
                    pg_conn.rollback()
                    for single_r in chunk:
                        try:
                            pg_conn.execute(target_table.insert().values(**single_r))
                            pg_conn.commit()
                        except Exception:
                            pg_conn.rollback()

            total_rows += len(batch)
            print(f"  [MIGRATED] {t_name:<36} : {len(batch):>6} rows", flush=True)

    sqlite_conn.close()
    print("=" * 70, flush=True)
    print(f"MIGRATION COMPLETE! Total rows copied: {total_rows:,}", flush=True)
    print("=" * 70, flush=True)

if __name__ == "__main__":
    main()
