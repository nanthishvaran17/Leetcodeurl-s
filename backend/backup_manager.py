import os
import shutil
import datetime
from typing import Dict, Any
from backend.logger import logger

BACKUP_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "backups")
os.makedirs(BACKUP_DIR, exist_ok=True)

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "leetcode_tracker.db")

def create_db_backup() -> Dict[str, Any]:
    """
    Creates a timestamped snapshot copy of the SQLite database.
    """
    if not os.path.exists(DB_PATH):
        return {"status": "ERROR", "message": "Database file not found."}

    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_file = os.path.join(BACKUP_DIR, f"backup_leetcode_tracker_{timestamp}.db")

    try:
        shutil.copy2(DB_PATH, backup_file)
        logger.info(f"Database backup created: {backup_file}")
        return {"status": "SUCCESS", "backup_path": backup_file, "filename": os.path.basename(backup_file)}
    except Exception as e:
        logger.error(f"Failed to create database backup: {e}")
        return {"status": "ERROR", "message": str(e)}

def list_backups() -> list:
    if not os.path.exists(BACKUP_DIR):
        return []
    files = [f for f in os.listdir(BACKUP_DIR) if f.endswith(".db")]
    files.sort(reverse=True)
    return files
