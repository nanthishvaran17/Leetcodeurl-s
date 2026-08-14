import os
import json
import base64

def initialize_firestore():
    """
    Safely initialize Firebase Admin SDK and return Firestore client if credentials exist.
    """
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore

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
                    print(f"[FIRESTORE] Service account env key parse error: {parse_err}")
            elif google_creds and os.path.exists(google_creds):
                cred = credentials.Certificate(google_creds)
            else:
                try:
                    cred = credentials.ApplicationDefault()
                except Exception:
                    cred = None

            if cred:
                firebase_admin.initialize_app(cred, {'projectId': 'leetcode-student-data'})
            else:
                try:
                    firebase_admin.initialize_app(options={'projectId': 'leetcode-student-data'})
                except Exception:
                    pass

        try:
            return firestore.client()
        except Exception:
            print("\n" + "!" * 80)
            print("[FIREBASE SERVICE ACCOUNT KEY REQUIRED]")
            print("To connect Python Admin SDK to Cloud Firestore, place 'serviceAccountKey.json'")
            print("in the project root directory or set the FIREBASE_SERVICE_ACCOUNT_KEY env var.")
            print("Download key: Firebase Console -> Project Settings -> Service accounts -> Generate new private key.")
            print("!" * 80 + "\n")
            return None

    except Exception as err:
        print(f"[FIRESTORE ERROR] Failed to initialize Firestore client: {err}")
        return None

def get_firestore_db():
    """Returns Cloud Firestore database client instance."""
    return initialize_firestore()
