"""
firebase_init.py — Centralized Firebase Admin SDK Initialization Module

Guarantees:
1. Single authoritative initialization of Firebase Admin SDK across the entire backend.
2. Prevents unauthenticated default apps from polluting firebase_admin._apps.
3. Supports env vars: FIREBASE_SERVICE_ACCOUNT_JSON, FIREBASE_CREDENTIALS_JSON, FIREBASE_CREDENTIALS, FIREBASE_SERVICE_ACCOUNT_BASE64.
4. Supports local disk fallback: serviceAccountKey.json, firebase-service-account.json.
5. Emits strict, secure diagnostic logs without leaking private keys or secrets.
"""

import os
import json
import base64
import logging
from typing import Optional

logger = logging.getLogger(__name__)

_FIREBASE_APP = None
_FIREBASE_INITIALIZED = False


def get_firebase_app():
    """
    Retrieves or initializes the Firebase Admin App using explicit service account credentials.
    Returns the initialized App object or None if valid credentials are not configured.
    """
    global _FIREBASE_APP, _FIREBASE_INITIALIZED

    try:
        import firebase_admin
        from firebase_admin import credentials
    except ImportError:
        logger.warning("[FCM] firebase_admin library is not installed.")
        return None

    if firebase_admin._apps:
        default_app = firebase_admin.get_app()
        _FIREBASE_APP = default_app
        return default_app

    default_proj_id = (
        os.environ.get("FIREBASE_PROJECT_ID") or 
        os.environ.get("GOOGLE_CLOUD_PROJECT") or 
        "leetcode-student-data"
    )

    cred = None
    project_id = default_proj_id

    # 1. Check JSON string from environment variables
    env_json = (
        os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON") or 
        os.environ.get("FIREBASE_CREDENTIALS_JSON") or 
        os.environ.get("FIREBASE_CREDENTIALS")
    )

    if env_json and env_json.strip():
        try:
            cred_dict = json.loads(env_json.strip())
            project_id = cred_dict.get("project_id") or default_proj_id
            cred = credentials.Certificate(cred_dict)
            logger.info(f"[FCM] Loaded credentials from environment JSON (projectId={project_id}).")
        except Exception as err:
            logger.warning(f"[FCM] Failed parsing environment JSON credential: {err}")

    # 2. Check Base64 encoded JSON string from environment variable
    if not cred:
        env_b64 = os.environ.get("FIREBASE_SERVICE_ACCOUNT_BASE64")
        if env_b64 and env_b64.strip():
            try:
                decoded_str = base64.b64decode(env_b64.strip()).decode('utf-8')
                cred_dict = json.loads(decoded_str)
                project_id = cred_dict.get("project_id") or default_proj_id
                cred = credentials.Certificate(cred_dict)
                logger.info(f"[FCM] Loaded credentials from Base64 environment variable (projectId={project_id}).")
            except Exception as err:
                logger.warning(f"[FCM] Failed parsing Base64 environment credential: {err}")

    # 3. Check Disk File paths
    if not cred:
        root_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        possible_paths = [
            os.path.join(root_dir, 'serviceAccountKey.json'),
            os.path.join(root_dir, 'firebase-service-account.json'),
            os.path.join(os.path.dirname(os.path.dirname(__file__)), 'serviceAccountKey.json'),
            os.path.join(os.path.dirname(__file__), 'serviceAccountKey.json'),
        ]
        for path in possible_paths:
            if os.path.exists(path):
                try:
                    with open(path, 'r', encoding='utf-8') as f:
                        cred_dict = json.load(f)
                        project_id = cred_dict.get("project_id") or default_proj_id
                    cred = credentials.Certificate(path)
                    logger.info(f"[FCM] Loaded credentials from disk file {os.path.basename(path)} (projectId={project_id}).")
                    break
                except Exception as err:
                    logger.warning(f"[FCM] Failed loading credential file {path}: {err}")

    # 4. Check GOOGLE_APPLICATION_CREDENTIALS path
    if not cred:
        gac_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
        if gac_path and os.path.exists(gac_path):
            try:
                with open(gac_path, 'r', encoding='utf-8') as f:
                    cred_dict = json.load(f)
                    project_id = cred_dict.get("project_id") or default_proj_id
                cred = credentials.Certificate(gac_path)
                logger.info(f"[FCM] Loaded credentials from GOOGLE_APPLICATION_CREDENTIALS file (projectId={project_id}).")
            except Exception as err:
                logger.warning(f"[FCM] Failed loading GOOGLE_APPLICATION_CREDENTIALS file: {err}")

    if cred:
        try:
            _FIREBASE_APP = firebase_admin.initialize_app(cred, {'projectId': project_id})
            _FIREBASE_INITIALIZED = True
            logger.info(f"[FCM] initialization_success project={project_id}")
            return _FIREBASE_APP
        except Exception as err:
            logger.error(f"[FCM] Error during initialize_app: {err}")
            return None
    else:
        logger.warning(
            "[FCM] No valid Firebase service account credentials found in environment or disk. "
            "FCM push notifications will be disabled until FIREBASE_SERVICE_ACCOUNT_JSON or serviceAccountKey.json is configured."
        )
        return None
