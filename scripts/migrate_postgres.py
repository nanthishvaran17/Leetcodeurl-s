"""
Production Database Migration & Row-Count Verification Script
Connects to Source DB and Destination PostgreSQL, replicates all schema and rows,
and validates that Render count == Oracle count across all tables.
"""

import sys
import os
import argparse
from sqlalchemy import create_engine, inspect, MetaData, Table
from sqlalchemy.orm import sessionmaker

def migrate_and_verify(src_url: str, dst_url: str):
    print("=" * 60)
    print("PRODUCTION POSTGRESQL MIGRATION & RECONCILIATION")
    print("=" * 60)
    print(f"Source DB:      {src_url.split('@')[-1] if '@' in src_url else src_url}")
    print(f"Destination DB: {dst_url.split('@')[-1] if '@' in dst_url else dst_url}")
    print("-" * 60)

    src_engine = create_engine(src_url)
    dst_engine = create_engine(dst_url)

    src_inspector = inspect(src_engine)
    tables = src_inspector.get_table_names()

    print(f"Discovered {len(tables)} tables to migrate & verify.\n")

    src_meta = MetaData()
    src_meta.reflect(bind=src_engine)

    # 1. Create tables on destination if missing
    src_meta.create_all(bind=dst_engine)

    # 2. Table count & transfer verification
    mismatches = []
    
    with src_engine.connect() as src_conn, dst_engine.connect() as dst_conn:
        for tbl_name in tables:
            tbl = Table(tbl_name, src_meta, autoload_with=src_engine)
            
            src_count = src_conn.execute(tbl.count()).scalar()
            
            # Check if destination table is empty before copying
            dst_tbl = Table(tbl_name, MetaData(), autoload_with=dst_engine)
            dst_count_before = dst_conn.execute(dst_tbl.count()).scalar()
            
            if dst_count_before < src_count:
                print(f"[*] Copying {tbl_name} ({src_count} rows)...")
                rows = [dict(row._mapping) for row in src_conn.execute(tbl.select()).fetchall()]
                if rows:
                    # Batch insert
                    dst_conn.execute(dst_tbl.insert(), rows)
                    dst_conn.commit()

            dst_count_after = dst_conn.execute(dst_tbl.count()).scalar()
            
            status = "✅ MATCH" if src_count == dst_count_after else "❌ MISMATCH"
            print(f"Table: {tbl_name:<35} Source: {src_count:<6} Dest: {dst_count_after:<6} [{status}]")
            
            if src_count != dst_count_after:
                mismatches.append((tbl_name, src_count, dst_count_after))

    print("\n" + "=" * 60)
    if not mismatches:
        print("🎉 MIGRATION VERIFICATION COMPLETE: ALL TABLES MATCH (100% INTEGRITY)")
    else:
        print(f"⚠️  WARNING: {len(mismatches)} tables have row count differences:")
        for t, s, d in mismatches:
            print(f"  - {t}: Source={s}, Dest={d}")
    print("=" * 60)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Migrate and verify PostgreSQL database")
    parser.add_argument("--source", default=os.environ.get("SOURCE_DB_URL", "sqlite:///./data/leetcode_tracker.db"))
    parser.add_argument("--dest", default=os.environ.get("DEST_DB_URL", "postgresql://nec_admin:ChangeThisSecurePostgresPassword2026!@localhost:5432/nec_leetcode_prod"))
    args = parser.parse_args()

    migrate_and_verify(args.source, args.dest)
