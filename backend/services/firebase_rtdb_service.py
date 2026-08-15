import os
import json
import base64

RTDB_URL = os.environ.get("FIREBASE_DATABASE_URL", "https://leetcode-student-data-default-rtdb.firebaseio.com")

def initialize_firebase_rtdb():
    """
    Safely initialize Firebase Admin SDK for Realtime Database access.
    """
    try:
        import firebase_admin
        from firebase_admin import credentials, db

        if not firebase_admin._apps:
            sa_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "serviceAccountKey.json")
            env_sa_key = os.environ.get("FIREBASE_SERVICE_ACCOUNT_KEY")
            google_creds = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")

            cred = None
            if os.path.exists(sa_path):
                cred = credentials.Certificate(sa_path)
            elif env_sa_key:
                try:
                    if env_sa_key.strip().startswith("{"):
                        sa_dict = json.loads(env_sa_key)
                    else:
                        sa_dict = json.loads(base64.b64decode(env_sa_key).decode('utf-8'))
                    cred = credentials.Certificate(sa_dict)
                except Exception as parse_err:
                    print(f"[FIREBASE RTDB] Service account env key parse error: {parse_err}")
            elif google_creds and os.path.exists(google_creds):
                cred = credentials.Certificate(google_creds)
            else:
                try:
                    cred = credentials.ApplicationDefault()
                except Exception:
                    cred = None

            if cred:
                firebase_admin.initialize_app(cred, {
                    'databaseURL': RTDB_URL
                })
            else:
                print("[FIREBASE RTDB NOTICE] No service account key found. Admin SDK running without Certificate.")
                firebase_admin.initialize_app(options={
                    'databaseURL': RTDB_URL
                })

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
