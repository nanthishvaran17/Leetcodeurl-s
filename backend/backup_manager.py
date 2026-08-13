import os
import shutil
import datetime
from typing import Dict, Any
from backend.logger import logger

BACKUP_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "backups")
os.makedirs(BACKUP_DIR, exist_ok=True)

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "leetcode_tracker.db")

import hashlib

def create_db_backup(prefix: str = "backup_leetcode_tracker") -> Dict[str, Any]:
    """
    Creates a timestamped snapshot copy of the SQLite database.
    """
    if not os.path.exists(DB_PATH):
        return {"status": "ERROR", "message": "Database file not found."}

    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{prefix}_{timestamp}.db"
    backup_file = os.path.join(BACKUP_DIR, filename)

    try:
        shutil.copy2(DB_PATH, backup_file)
        size_bytes = os.path.getsize(backup_file)
        
        # Calculate SHA256 checksum
        hasher = hashlib.sha256()
        with open(backup_file, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hasher.update(chunk)
        checksum = hasher.hexdigest()[:16]

        logger.info(f"Database backup created: {backup_file} (checksum={checksum})")
        return {
            "status": "SUCCESS",
            "backup_path": backup_file,
            "filename": filename,
            "size_bytes": size_bytes,
            "checksum": checksum,
            "created_at": datetime.datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Failed to create database backup: {e}")
        return {"status": "ERROR", "message": str(e)}

def list_backups_detail() -> list:
    if not os.path.exists(BACKUP_DIR):
        return []
    files = [f for f in os.listdir(BACKUP_DIR) if f.endswith(".db")]
    files.sort(reverse=True)
    
    result = []
    for f in files:
        f_path = os.path.join(BACKUP_DIR, f)
        stat = os.stat(f_path)
        mtime = datetime.datetime.fromtimestamp(stat.st_mtime).isoformat()
        
        # Calculate checksum
        try:
            hasher = hashlib.sha256()
            with open(f_path, "rb") as fp:
                for chunk in iter(lambda: fp.read(4096), b""):
                    hasher.update(chunk)
            chk = hasher.hexdigest()[:16]
            status = "HEALTHY"
        except Exception:
            chk = "UNKNOWN"
            status = "ERROR"

        result.append({
            "filename": f,
            "created_at": mtime,
            "size_bytes": stat.st_size,
            "checksum": chk,
            "status": status
        })
    return result

def list_backups() -> list:
    return list_backups_detail()

def verify_backup(filename: str) -> Dict[str, Any]:
    safe_name = os.path.basename(filename)
    f_path = os.path.join(BACKUP_DIR, safe_name)
    if not os.path.exists(f_path):
        return {"status": "ERROR", "verified": False, "message": "Backup file not found."}
    
    try:
        with open(f_path, "rb") as f:
            header = f.read(16)
        if header.startswith(b"SQLite format 3"):
            hasher = hashlib.sha256()
            with open(f_path, "rb") as f:
                for chunk in iter(lambda: f.read(4096), b""):
                    hasher.update(chunk)
            chk = hasher.hexdigest()[:16]
            return {
                "status": "SUCCESS",
                "verified": True,
                "filename": safe_name,
                "checksum": chk,
                "message": "Backup integrity verified cleanly. SQLite header valid."
            }
        else:
            return {"status": "ERROR", "verified": False, "message": "Invalid SQLite header."}
    except Exception as e:
        return {"status": "ERROR", "verified": False, "message": str(e)}

def restore_backup(filename: str) -> Dict[str, Any]:
    safe_name = os.path.basename(filename)
    f_path = os.path.join(BACKUP_DIR, safe_name)
    if not os.path.exists(f_path):
        return {"status": "ERROR", "message": "Backup file not found."}

    # Verify first
    ver = verify_backup(safe_name)
    if not ver.get("verified"):
        return {"status": "ERROR", "message": f"Integrity check failed: {ver.get('message')}"}

    # Create safety backup first
    safety_res = create_db_backup(prefix="safety_pre_restore")
    if safety_res.get("status") != "SUCCESS":
        return {"status": "ERROR", "message": "Safety pre-restore backup failed. Aborting restore."}

    try:
        shutil.copy2(f_path, DB_PATH)
        logger.info(f"Database restored from {safe_name}. Pre-restore backup saved as {safety_res.get('filename')}")
        return {
            "status": "SUCCESS",
            "message": f"Database successfully restored from snapshot '{safe_name}'. Safety backup created: '{safety_res.get('filename')}'.",
            "safety_backup": safety_res.get("filename")
        }
    except Exception as e:
        logger.error(f"Restore database failed: {e}")
        return {"status": "ERROR", "message": str(e)}

def delete_backup(filename: str) -> Dict[str, Any]:
    safe_name = os.path.basename(filename)
    f_path = os.path.join(BACKUP_DIR, safe_name)
    if not os.path.exists(f_path):
        return {"status": "ERROR", "message": "Backup file not found."}
    try:
        os.remove(f_path)
        logger.info(f"Backup file deleted: {safe_name}")
        return {"status": "SUCCESS", "filename": safe_name, "message": "Snapshot deleted successfully."}
    except Exception as e:
        return {"status": "ERROR", "message": str(e)}
