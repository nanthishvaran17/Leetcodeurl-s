"""
backup_database.py — Automated Database Backup System for Nandha Engineering College.
Creates daily timestamped database snapshots with gzip compression and 30-day retention rotation.
"""

import os
import sys
import shutil
import datetime
import gzip

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.config import settings
from backend.logger import logger


def perform_database_backup(backup_dir: str = "data/backups/daily", keep_days: int = 30) -> str:
    os.makedirs(backup_dir, exist_ok=True)
    db_path = settings.DATABASE_URL.replace("sqlite:///", "").replace("sqlite://", "")
    if not os.path.isabs(db_path):
        db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), db_path)

    if not os.path.exists(db_path):
        logger.error(f"[BACKUP] Source database not found at {db_path}")
        return ""

    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_filename = f"nandha_leetcode_backup_{timestamp}.db.gz"
    backup_file_path = os.path.join(backup_dir, backup_filename)

    logger.info(f"[BACKUP] Creating compressed database backup to {backup_file_path}...")
    with open(db_path, "rb") as f_in:
        with gzip.open(backup_file_path, "wb") as f_out:
            shutil.copyfileobj(f_in, f_out)

    backup_size_kb = round(os.path.getsize(backup_file_path) / 1024, 2)
    logger.info(f"[BACKUP_SUCCESS] Backup created successfully: {backup_file_path} ({backup_size_kb} KB)")

    # Rotate old backups
    now_dt = datetime.datetime.now()
    for fname in os.listdir(backup_dir):
        if fname.endswith(".db.gz"):
            fpath = os.path.join(backup_dir, fname)
            f_mtime = datetime.datetime.fromtimestamp(os.path.getmtime(fpath))
            if (now_dt - f_mtime).days > keep_days:
                try:
                    os.remove(fpath)
                    logger.info(f"[BACKUP_ROTATION] Removed old backup: {fname}")
                except Exception as e:
                    logger.warning(f"[BACKUP_ROTATION_ERROR] Could not remove {fname}: {e}")

    return backup_file_path


if __name__ == "__main__":
    result = perform_database_backup()
    print(f"Database backup completed: {result}")
