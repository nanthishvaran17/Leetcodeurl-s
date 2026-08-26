"""
Authoritative Pre-Migration Database Snapshot and Verification Script
"""
import os
import shutil
import hashlib
import sqlite3
import datetime
import zoneinfo
import json

IST_TZ = zoneinfo.ZoneInfo("Asia/Kolkata")
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA_DIR = os.path.join(ROOT_DIR, "data")
DB_PATH = os.path.join(DATA_DIR, "leetcode_tracker.db")
BACKUP_DIR = os.path.join(DATA_DIR, "backups")

os.makedirs(BACKUP_DIR, exist_ok=True)

def create_authoritative_snapshot():
    if not os.path.exists(DB_PATH):
        raise FileNotFoundError(f"Source database not found at {DB_PATH}")

    now_ist = datetime.datetime.now(IST_TZ)
    timestamp_str = now_ist.strftime("%Y%m%d_%H%M%S")
    snapshot_filename = f"pre_migration_authoritative_snapshot_{timestamp_str}.db"
    snapshot_path = os.path.join(BACKUP_DIR, snapshot_filename)

    # 1. Compute source SHA-256
    source_hasher = hashlib.sha256()
    with open(DB_PATH, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            source_hasher.update(chunk)
    source_sha256 = source_hasher.hexdigest()
    source_size = os.path.getsize(DB_PATH)

    # 2. Copy to snapshot
    shutil.copy2(DB_PATH, snapshot_path)

    # 3. Verify snapshot SHA-256
    target_hasher = hashlib.sha256()
    with open(snapshot_path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            target_hasher.update(chunk)
    target_sha256 = target_hasher.hexdigest()
    target_size = os.path.getsize(snapshot_path)

    if source_sha256 != target_sha256 or len(target_sha256) != 64:
        raise ValueError(f"Checksum mismatch! Source={source_sha256}, Target={target_sha256}")

    # 4. Verify SQLite Header & Table Counts
    conn = sqlite3.connect(snapshot_path)
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = [t[0] for t in cursor.fetchall() if not t[0].startswith("sqlite_")]

    table_counts = {}
    for t in sorted(tables):
        cursor.execute(f'SELECT COUNT(*) FROM "{t}"')
        table_counts[t] = cursor.fetchone()[0]

    conn.close()

    manifest = {
        "status": "VERIFIED",
        "timestamp_ist": now_ist.strftime("%Y-%m-%d %H:%M:%S %Z"),
        "source_db": DB_PATH,
        "source_size_bytes": source_size,
        "source_sha256": source_sha256,
        "snapshot_path": snapshot_path,
        "snapshot_filename": snapshot_filename,
        "snapshot_size_bytes": target_size,
        "snapshot_sha256": target_sha256,
        "total_tables": len(tables),
        "student_count": table_counts.get("students", 0),
        "user_count": table_counts.get("users", 0),
        "faculty_assignments_count": table_counts.get("faculty_student_assignments", 0),
        "weekly_public_results_count": table_counts.get("weekly_public_results", 0),
        "table_counts": table_counts
    }

    manifest_path = os.path.join(BACKUP_DIR, f"{snapshot_filename}.manifest.json")
    with open(manifest_path, "w", encoding="utf-8") as mf:
        json.dump(manifest, mf, indent=2)

    print(json.dumps(manifest, indent=2))
    return manifest

if __name__ == "__main__":
    create_authoritative_snapshot()
