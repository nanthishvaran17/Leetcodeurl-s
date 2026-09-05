import os
import json
import base64
import time
import random
import threading
from typing import Dict, Any

from backend.logger import logger


class FirestoreCircuitBreaker:
    """
    Production-grade Circuit Breaker for Google Cloud Firestore.
    Protects free-tier/rate-limited Firestore instances from repetitive 429 Quota Exceeded error cascades.
    State transitions:
      - CLOSED: Normal operation. Requests proceed.
      - OPEN: Quota exhausted or rate-limited. All Firestore requests immediately fast-fail (no network calls).
      - HALF_OPEN: Cooldown expired. Trial requests allowed to verify quota recovery.
    """
    def __init__(self, base_cooldown_seconds: int = 300):
        self.base_cooldown = base_cooldown_seconds
        self.state: str = "CLOSED"
        self.cooldown_until: float = 0.0
        self.failure_count: int = 0
        self.consecutive_429s: int = 0
        self._lock = threading.Lock()
        self._last_logged_time: float = 0.0

    def is_available(self) -> bool:
        with self._lock:
            now = time.time()
            if self.state == "OPEN":
                if now >= self.cooldown_until:
                    self.state = "HALF_OPEN"
                    logger.info("[FIRESTORE_CIRCUIT_BREAKER] Cooldown expired. Transitioning to HALF_OPEN trial mode.")
                    return True
                return False
            return True

    def record_success(self):
        with self._lock:
            self.failure_count = 0
            self.consecutive_429s = 0
            if self.state == "HALF_OPEN":
                self.state = "CLOSED"
                logger.info("[FIRESTORE_CIRCUIT_BREAKER] Trial write successful. Circuit CLOSED (normal sync active).")

    def record_error(self, err: Exception) -> bool:
        """
        Records an error. If quota-related, trips circuit breaker to OPEN state.
        Returns True if error was a quota/resource-exhaustion error.
        """
        err_str = str(err).lower()
        is_quota = (
            "429" in err_str
            or "quota exceeded" in err_str
            or "resourceexhausted" in err_str
            or "resource_exhausted" in err_str
        )
        with self._lock:
            self.failure_count += 1
            now = time.time()
            if is_quota:
                self.consecutive_429s += 1
                self.state = "OPEN"
                backoff = min(1800, self.base_cooldown * (2 ** (min(3, self.consecutive_429s) - 1)))
                jitter = random.uniform(5, 25)
                self.cooldown_until = now + backoff + jitter
                if now - self._last_logged_time > 60:
                    self._last_logged_time = now
                    logger.warning(
                        f"[FIRESTORE_CIRCUIT_BREAKER] 429 Quota Exceeded detected. "
                        f"Firestore sync paused for {int(backoff + jitter)}s. "
                        f"Primary SQLite database & FastAPI routes remain 100% operational."
                    )
            return is_quota

    def get_status(self) -> Dict[str, Any]:
        with self._lock:
            now = time.time()
            remaining = max(0.0, self.cooldown_until - now) if self.state == "OPEN" else 0.0
            return {
                "state": self.state,
                "is_available": self.is_available(),
                "failure_count": self.failure_count,
                "consecutive_429s": self.consecutive_429s,
                "cooldown_remaining_seconds": round(remaining, 1)
            }


circuit_breaker = FirestoreCircuitBreaker(base_cooldown_seconds=300)


def initialize_firestore():
    """
    Safely initialize Firebase Admin SDK and return Firestore client ONLY if credentials exist.
    Avoids triggering ADC warning when running standalone on SQLite.
    """
    try:
        sa_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "serviceAccountKey.json")
        env_sa_key = os.environ.get("FIREBASE_SERVICE_ACCOUNT_KEY")
        google_creds = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")

        from backend.services.firebase_init import get_firebase_app
        app = get_firebase_app()
        if not app:
            return None
        from firebase_admin import firestore
        return firestore.client()

    except Exception as e:
        logger.debug(f"[FIRESTORE] Admin SDK init note: {e}")
        return None


def get_firestore_db():
    """Returns Cloud Firestore database client instance if circuit breaker permits."""
    if not circuit_breaker.is_available():
        return None
    return initialize_firestore()


get_firestore_client = get_firestore_db


def get_circuit_breaker() -> FirestoreCircuitBreaker:
    """Returns the global Firestore circuit breaker instance."""
    return circuit_breaker


def get_firestore_students() -> list:
    """Reads all active student records dynamically from Cloud Firestore collection 'students'."""
    if not circuit_breaker.is_available():
        return []
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
        circuit_breaker.record_success()
        return students
    except Exception as err:
        is_q = circuit_breaker.record_error(err)
        if not is_q:
            logger.warning(f"[FIRESTORE] Failed to fetch students collection: {err}")
        return []


def update_firestore_doc(collection_name: str, doc_id: str, data: dict) -> bool:
    """Writes or merges a single document in Cloud Firestore with circuit-breaker protection."""
    if not circuit_breaker.is_available():
        return False
    db = get_firestore_db()
    if not db:
        return False
    try:
        clean_id = str(doc_id).strip()
        doc_ref = db.collection(collection_name).document(clean_id)
        doc_ref.set(data, merge=True)
        circuit_breaker.record_success()
        return True
    except Exception as err:
        is_q = circuit_breaker.record_error(err)
        if not is_q:
            logger.warning(f"[FIRESTORE] Failed to update document {collection_name}/{doc_id}: {err}")
        return False


def get_firestore_doc(collection_name: str, doc_id: str) -> dict:
    """Reads a single document from Cloud Firestore safely with circuit-breaker protection."""
    if not circuit_breaker.is_available():
        return {}
    db = get_firestore_db()
    if not db:
        return {}
    try:
        clean_id = str(doc_id).strip()
        doc_ref = db.collection(collection_name).document(clean_id)
        doc = doc_ref.get()
        circuit_breaker.record_success()
        return doc.to_dict() if doc.exists else {}
    except Exception as err:
        is_q = circuit_breaker.record_error(err)
        if not is_q:
            logger.debug(f"[FIRESTORE] Document {collection_name}/{doc_id} read note: {err}")
        return {}


def save_firestore_sync_job(job_id: str, job_data: dict) -> bool:
    """Saves or updates a persistent sync job document in Cloud Firestore collection 'sync_jobs'."""
    return update_firestore_doc("sync_jobs", job_id, job_data)


