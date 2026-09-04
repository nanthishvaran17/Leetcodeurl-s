import os
import json
import base64

RTDB_URL = os.environ.get("FIREBASE_DATABASE_URL", "https://leetcode-student-data-default-rtdb.firebaseio.com")

def initialize_firebase_rtdb():
    """
    Safely initialize Firebase Admin SDK for Realtime Database access.
    """
    try:
        from backend.services.firebase_init import get_firebase_app
        app = get_firebase_app()
        if not app:
            return None
        from firebase_admin import db
        return db
    except Exception as err:
        print(f"[FIREBASE RTDB ERROR] Failed to initialize Firebase Admin SDK: {err}")
        return None

def get_rtdb_reference(path: str = "/"):
    """
    Returns a Firebase Realtime Database reference for the given child path.
    """
    try:
        rtdb = initialize_firebase_rtdb()
        if rtdb:
            return rtdb.reference(path, url=RTDB_URL)
    except Exception:
        pass
    return None
