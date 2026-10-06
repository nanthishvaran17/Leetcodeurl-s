from fastapi import APIRouter, Depends, HTTPException, Body
from pydantic import BaseModel
import os
from typing import List, Optional
from backend.routes.auth import get_current_user
from backend.models import User

router = APIRouter()

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../"))

class FileInfo(BaseModel):
    name: str
    path: str
    is_dir: bool

class FileContent(BaseModel):
    content: str

class SaveFileRequest(BaseModel):
    path: str
    content: str
    duration_seconds: Optional[int] = 0

AUDIT_LOG_PATH = os.path.join(PROJECT_ROOT, "backend", "logs", "dev_studio_audit.json")

def get_safe_path(requested_path: str) -> str:
    # Ensure the requested path is within the project root
    safe_path = os.path.abspath(os.path.join(PROJECT_ROOT, requested_path))
    if not safe_path.startswith(PROJECT_ROOT):
        raise HTTPException(status_code=403, detail="Access denied")
    return safe_path

@router.get("/tree")
def get_file_tree(path: str = "", current_user: User = Depends(get_current_user)):
    if current_user.role.lower() not in ["admin", "super_admin", "administrator", "super admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    target_path = get_safe_path(path)
    if not os.path.exists(target_path):
        raise HTTPException(status_code=404, detail="Path not found")
    if not os.path.isdir(target_path):
        raise HTTPException(status_code=400, detail="Path is not a directory")
    
    files = []
    try:
        for f in os.listdir(target_path):
            if f.startswith('.') or f in ['__pycache__', 'node_modules', 'dist', '.git']:
                continue
            full_path = os.path.join(target_path, f)
            rel_path = os.path.relpath(full_path, PROJECT_ROOT).replace("\\", "/")
            files.append({
                "name": f,
                "path": rel_path,
                "is_dir": os.path.isdir(full_path)
            })
        return sorted(files, key=lambda x: (not x["is_dir"], x["name"].lower()))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/file")
def read_file(path: str, current_user: User = Depends(get_current_user)):
    if current_user.role.lower() not in ["admin", "super_admin", "administrator", "super admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
        
    target_path = get_safe_path(path)
    if not os.path.exists(target_path):
        raise HTTPException(status_code=404, detail="File not found")
    if os.path.isdir(target_path):
        raise HTTPException(status_code=400, detail="Path is a directory")
        
    try:
        with open(target_path, "r", encoding="utf-8") as f:
            content = f.read()
        return {"content": content}
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="Cannot read binary file")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/file")
def save_file(req: SaveFileRequest, current_user: User = Depends(get_current_user)):
    if current_user.role.lower() not in ["admin", "super_admin", "administrator", "super admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
        
    target_path = get_safe_path(req.path)
    try:
        # Use atomic write via temp file to avoid EBUSY lock errors with Vite HMR on Windows
        temp_path = target_path + ".tmp"
        with open(temp_path, "w", encoding="utf-8") as f:
            f.write(req.content)
        os.replace(temp_path, target_path)
        
        # Audit Log Entry
        import json
        from datetime import datetime
        
        os.makedirs(os.path.dirname(AUDIT_LOG_PATH), exist_ok=True)
        audit_entry = {
            "timestamp": datetime.now().isoformat(),
            "admin_name": current_user.name,
            "admin_email": current_user.email,
            "role": current_user.role,
            "file_modified": req.path,
            "duration_seconds": req.duration_seconds
        }
        
        try:
            if os.path.exists(AUDIT_LOG_PATH):
                with open(AUDIT_LOG_PATH, "r") as logf:
                    logs = json.load(logf)
            else:
                logs = []
        except:
            logs = []
            
        logs.append(audit_entry)
        with open(AUDIT_LOG_PATH, "w") as logf:
            json.dump(logs, logf, indent=2)

        return {"status": "SUCCESS", "message": f"Saved {req.path}"}
    except Exception as e:
        if os.path.exists(target_path + ".tmp"):
            try:
                os.remove(target_path + ".tmp")
            except:
                pass
        raise HTTPException(status_code=500, detail=str(e))

from fastapi.responses import FileResponse

@router.get("/download")
def download_file(path: str, current_user: User = Depends(get_current_user)):
    if current_user.role.lower() not in ["admin", "super_admin", "administrator", "super admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
        
    target_path = get_safe_path(path)
    if not os.path.exists(target_path):
        raise HTTPException(status_code=404, detail="File not found")
    if os.path.isdir(target_path):
        raise HTTPException(status_code=400, detail="Path is a directory")
        
    return FileResponse(target_path, filename=os.path.basename(target_path))

@router.get("/audit-report")
def get_audit_report(current_user: User = Depends(get_current_user)):
    if current_user.role.lower() not in ["admin", "super_admin", "administrator", "super admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    if not os.path.exists(AUDIT_LOG_PATH):
        raise HTTPException(status_code=404, detail="No audit logs found")
    return FileResponse(AUDIT_LOG_PATH, filename="Developer_Studio_Audit_Report.json")
