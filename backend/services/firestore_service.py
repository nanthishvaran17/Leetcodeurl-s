import os
import json
import base64

def initialize_firestore():
    """
    Safely initialize Firebase Admin SDK and return Firestore client ONLY if credentials exist.
    Avoids triggering ADC warning when running standalone on SQLite.
    """
    try:
        sa_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "serviceAccountKey.json")
        env_sa_key = os.environ.get("FIREBASE_SERVICE_ACCOUNT_KEY")
        google_creds = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")

        has_creds = os.path.exists(sa_path) or bool(env_sa_key) or (bool(google_creds) and os.path.exists(google_creds))
        if not has_creds:
            return None

        import firebase_admin
        from firebase_admin import credentials, firestore

        if not firebase_admin._apps:
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
                except Exception:
                    cred = None
            elif google_creds and os.path.exists(google_creds):
                cred = credentials.Certificate(google_creds)

            if cred:
                firebase_admin.initialize_app(cred, {'projectId': 'leetcode-student-data'})
            else:
                return None

        return firestore.client()

    except Exception:
        return None

def get_firestore_db():
    """Returns Cloud Firestore database client instance."""
    return initialize_firestore()


def get_firestore_students() -> list:
    """Reads all active student records dynamically from Cloud Firestore collection 'students'."""
    db = get_firestore_db()
    if not db:
        return []
    try:
        docs = db.collection("students").stream()
        students = []
        for doc in docs:
            data = doc.to_dict()
            if data and data.get("is_active", True) is not False:
                students.append(data)
        return students
    except Exception as err:
        from backend.logger import logger
        logger.warning(f"[FIRESTORE] Failed to fetch students collection: {err}")
        return []


def update_firestore_doc(collection_name: str, doc_id: str, data: dict) -> bool:
    """Writes or merges a document in Cloud Firestore."""
    db = get_firestore_db()
    if not db:
        return False
    try:
        clean_id = str(doc_id).strip()
        doc_ref = db.collection(collection_name).document(clean_id)
        doc_ref.set(data, merge=True)
        return True
    except Exception as err:
        from backend.logger import logger
        logger.warning(f"[FIRESTORE] Failed to update document {collection_name}/{doc_id}: {err}")
        return False


def get_firestore_doc(collection_name: str, doc_id: str) -> dict:
    """Reads a single document from Cloud Firestore safely."""
    db = get_firestore_db()
    if not db:
        return {}
    try:
        clean_id = str(doc_id).strip()
        doc_ref = db.collection(collection_name).document(clean_id)
        doc = doc_ref.get()
        return doc.to_dict() if doc.exists else {}
    except Exception as err:
        from backend.logger import logger
        logger.debug(f"[FIRESTORE] Document {collection_name}/{doc_id} not found or read note: {err}")
        return {}


def save_firestore_sync_job(job_id: str, job_data: dict) -> bool:
    """Saves or updates a persistent sync job document in Cloud Firestore collection 'sync_jobs'."""
    return update_firestore_doc("sync_jobs", job_id, job_data)

