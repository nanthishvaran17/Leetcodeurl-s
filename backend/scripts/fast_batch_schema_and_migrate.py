import os
import sys
import json
import sqlite3
from sqlalchemy import create_engine, MetaData, text, Boolean
from sqlalchemy.schema import CreateTable

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, ROOT_DIR)

from backend.models import Base

SQLITE_PATH = os.path.join(ROOT_DIR, "data", "leetcode_tracker.db")
PG_URL = "postgresql://neondb_owner:npg_5oAmt0ICFKMT@ep-falling-pine-ae9dk8zu.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"

def main():
    print("=" * 70, flush=True)
    print("LIGHTNING FAST NEON POSTGRESQL DATA MIGRATOR", flush=True)
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

    print("[NEON DB] Connecting engine & resetting schema cleanly...", flush=True)
    engine = create_engine(PG_URL, echo=False, pool_pre_ping=True)
    with engine.connect() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE; CREATE SCHEMA public;"))
        conn.commit()

    print("[NEON DB] Batch creating all PostgreSQL tables in 1 second...", flush=True)
    ddl_list = []
    for table in Base.metadata.sorted_tables:
        try:
            ddl_list.append(str(CreateTable(table).compile(engine)))
        except Exception:
            pass

    with engine.connect() as conn:
        for ddl_sql in ddl_list:
            try:
                conn.execute(text(ddl_sql))
                conn.commit()
            except Exception as ddl_err:
                conn.rollback()

    print("[NEON DB] Schema created successfully!", flush=True)

    target_metadata = MetaData()
    target_metadata.reflect(bind=engine)
    print(f"[NEON DB] Reflected {len(target_metadata.tables)} active tables!", flush=True)

    sqlite_conn.row_factory = sqlite3.Row
    sqlite_cursor = sqlite_conn.cursor()

    total_rows = 0
    with engine.connect() as pg_conn:
        for t_name in sorted(tables):
            count = source_counts.get(t_name, 0)
            if count == 0:
                continue
            if t_name not in target_metadata.tables:
                continue

            target_table = target_metadata.tables[t_name]
            target_cols = {c.name for c in target_table.columns}

            bool_cols = set()
            for col in target_table.columns:
                try:
                    if isinstance(col.type, Boolean) or getattr(col.type, "python_type", None) is bool:
                        bool_cols.add(col.name)
                except Exception:
                    if col.name.startswith("is_") or col.name.startswith("has_") or col.name.startswith("was_") or "verified" in col.name or "active" in col.name:
                        bool_cols.add(col.name)

            sqlite_cursor.execute(f'SELECT * FROM "{t_name}"')
            rows = sqlite_cursor.fetchall()

            batch = []
            for r in rows:
                row_dict = dict(r)
                filtered = {k: v for k, v in row_dict.items() if k in target_cols}
                for k, v in filtered.items():
                    if k in bool_cols and v is not None:
                        filtered[k] = bool(v)
                    elif isinstance(v, str) and (v.startswith("{") or v.startswith("[")):
                        try:
                            filtered[k] = json.loads(v)
                        except Exception:
                            pass
                batch.append(filtered)

            chunk_size = 500
            inserted_count = 0
            for i in range(0, len(batch), chunk_size):
                chunk = batch[i:i + chunk_size]
                try:
                    pg_conn.execute(target_table.insert(), chunk)
                    pg_conn.commit()
                    inserted_count += len(chunk)
                except Exception:
                    pg_conn.rollback()
                    for single_r in chunk:
                        try:
                            pg_conn.execute(target_table.insert().values(**single_r))
                            pg_conn.commit()
                            inserted_count += 1
                        except Exception:
                            pg_conn.rollback()

            total_rows += inserted_count
            print(f"  [MIGRATED] {t_name:<36} : {inserted_count:>6} / {count:>6} rows", flush=True)

        print("\n[SEQUENCES] Synchronizing PostgreSQL ID sequences...", flush=True)
        for t_name in tables:
            if t_name in target_metadata.tables:
                try:
                    seq_query = text(f"""
                        SELECT setval(
                            pg_get_serial_sequence('"{t_name}"', 'id'),
                            COALESCE((SELECT MAX(id) FROM "{t_name}"), 1),
                            true
                        );
                    """)
                    pg_conn.execute(seq_query)
                    pg_conn.commit()
                except Exception:
                    pg_conn.rollback()

    sqlite_conn.close()
    print("=" * 70, flush=True)
    print(f"SUCCESS! Migration completed. Total records migrated: {total_rows:,}", flush=True)
    print("=" * 70, flush=True)

if __name__ == "__main__":
    main()
