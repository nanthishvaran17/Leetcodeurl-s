from fastapi import APIRouter, Depends, HTTPException, Body, Request
from pydantic import BaseModel
import os
import jwt
from typing import List, Optional
from backend.routes.auth import get_current_user
from backend.config import settings
from backend.models import User

router = APIRouter()

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../"))

def verify_dev_studio_access(request: Request, current_user: User = Depends(get_current_user)) -> User:
    role_clean = (current_user.role or "").strip().lower()
    if role_clean not in ["admin", "super_admin", "administrator", "super admin"]:
        raise HTTPException(status_code=403, detail="Developer Studio is restricted to system administrators.")

    # Strictly verify that this session was authenticated via 2FA OTP (/admin portal)
    auth_header = request.headers.get("Authorization") or ""
    token = ""
    if auth_header.lower().startswith("bearer "):
        token = auth_header[7:].strip()
    if not token:
        token = (
            request.cookies.get("admin_session_token")
            or request.cookies.get("access_token")
            or request.cookies.get("token")
            or ""
        )

    is_otp_verified = False
    if token and token.count(".") == 2:
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            if payload.get("admin_otp_verified") is True:
                is_otp_verified = True
        except Exception:
            pass

    if not is_otp_verified and getattr(current_user, "admin_otp_verified", False):
        is_otp_verified = True

    if not is_otp_verified:
        raise HTTPException(
            status_code=403,
            detail="Developer Studio requires 2-Factor OTP verification via the /admin portal. Direct or unverified access is strictly denied."
        )

    return current_user

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
def get_file_tree(path: str = "", current_user: User = Depends(verify_dev_studio_access)):
    
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
def read_file(path: str, current_user: User = Depends(verify_dev_studio_access)):
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
def save_file(req: SaveFileRequest, current_user: User = Depends(verify_dev_studio_access)):
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
        admin_display = getattr(current_user, "full_name", None) or getattr(current_user, "name", None) or current_user.username
        audit_entry = {
            "timestamp": datetime.now().isoformat(),
            "admin_name": admin_display,
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

import json
import datetime
from fastapi.responses import FileResponse

@router.get("/download")
def download_file(path: str, current_user: User = Depends(verify_dev_studio_access)):
    target_path = get_safe_path(path)
    if not os.path.exists(target_path):
        raise HTTPException(status_code=404, detail="File not found")
    if os.path.isdir(target_path):
        raise HTTPException(status_code=400, detail="Path is a directory")
        
    return FileResponse(target_path, filename=os.path.basename(target_path))

@router.get("/audit-report")
def get_audit_report(current_user: User = Depends(verify_dev_studio_access)):
    os.makedirs(os.path.dirname(AUDIT_LOG_PATH), exist_ok=True)
    if not os.path.exists(AUDIT_LOG_PATH):
        initial_data = {
            "title": "Developer Studio Edit Audit Report",
            "system": "Nandha Intelligence Platform",
            "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "events": []
        }
        with open(AUDIT_LOG_PATH, "w", encoding="utf-8") as f:
            json.dump(initial_data, f, indent=2)
            
    return FileResponse(
        AUDIT_LOG_PATH, 
        media_type="application/json",
        filename="Developer_Studio_Audit_Report.json"
    )
