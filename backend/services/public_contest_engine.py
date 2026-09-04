import asyncio
import logging
import random
import time
import uuid
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Set, Tuple, Any

import httpx
from sqlalchemy import func
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from backend.models import (
    WeeklySession, Student, OfficialPublicParticipant, PublicContestSyncAudit
)
from backend.services.authorization_service import get_authorized_student_ids

logger = logging.getLogger(__name__)

# ─── 1. CIRCUIT BREAKER CLASS ─────────────────────────────────────────────────
class CircuitBreaker:
    """
    Circuit Breaker pattern for upstream LeetCode API protection.
    States: CLOSED -> OPEN -> HALF_OPEN -> CLOSED
    """
    CLOSED = "CLOSED"
    OPEN = "OPEN"
    HALF_OPEN = "HALF_OPEN"

    def __init__(self, failure_threshold: int = 5, cooldown_seconds: float = 30.0):
        self.state = self.CLOSED
        self.failure_count = 0
        self.failure_threshold = failure_threshold
        self.cooldown_seconds = cooldown_seconds
        self.last_failure_time = 0.0

    def can_execute(self) -> bool:
        now = time.time()
        if self.state == self.OPEN:
            if now - self.last_failure_time >= self.cooldown_seconds:
                self.state = self.HALF_OPEN
                logger.info("[CircuitBreaker] Transitioned from OPEN to HALF_OPEN (Testing upstream connection)")
                return True
            return False
        return True

    def record_success(self):
        if self.state in (self.OPEN, self.HALF_OPEN):
            logger.info(f"[CircuitBreaker] Upstream call succeeded. Transitioning from {self.state} to CLOSED.")
        self.failure_count = 0
        self.state = self.CLOSED

    def record_failure(self):
        self.failure_count += 1
        self.last_failure_time = time.time()
        if self.failure_count >= self.failure_threshold:
            self.state = self.OPEN
            logger.warning(f"[CircuitBreaker] Failure threshold ({self.failure_threshold}) reached. Circuit Breaker is now OPEN.")

# Global Circuit Breaker Instance
_global_circuit_breaker = CircuitBreaker()

# ─── 2. PROCESS-LOCAL SINGLE-FLIGHT LOCK ─────────────────────────────────────
_single_flight_locks: Dict[str, asyncio.Lock] = {}
_single_flight_global_lock = asyncio.Lock()

async def get_single_flight_lock(contest_key: str) -> asyncio.Lock:
    """Ensure multiple simultaneous requests on the same process share 1 lock."""
    async with _single_flight_global_lock:
        if contest_key not in _single_flight_locks:
            _single_flight_locks[contest_key] = asyncio.Lock()
        return _single_flight_locks[contest_key]


# ─── 3. PUBLIC CONTEST ENGINE v10.0 ──────────────────────────────────────────
class PublicContestEngine:
    """
    Official Public/Live LeetCode Contest Participation Engine v10.0.
    Versioned dataset architecture, distributed DB lock recovery, fail-closed completeness,
    and role-authorized server-side isolation.
    """

    HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json",
        "Referer": "https://leetcode.com/contest/"
    }

    @staticmethod
    def normalize_username(raw_username: Optional[str]) -> str:
        """
        Create comparison key using EXACT rule:
        - trim whitespace
        - lowercase
        """
        if not raw_username:
            return ""
        return raw_username.strip().lower()

    @staticmethod
    async def fetch_leaderboard_page_with_retry(
        client: httpx.AsyncClient,
        slug: str,
        page: int,
        max_retries: int = 4
    ) -> Tuple[bool, Optional[Dict[str, Any]], int, Optional[str]]:
        """
        Fetch a single leaderboard page with adaptive rate limiting:
        - HTTP 429 & Retry-After support
        - Exponential backoff + jitter
        """
        url = f"https://leetcode.com/contest/api/ranking/{slug}/?pagination={page}&region=global"
        retry_count = 0

        for attempt in range(max_retries + 1):
            if not _global_circuit_breaker.can_execute():
                return False, None, retry_count, "Circuit breaker is OPEN due to repeated upstream failures."

            try:
                resp = await client.get(url, headers=PublicContestEngine.HEADERS, timeout=12.0)

                if resp.status_code == 200:
                    data = resp.json()
                    # Schema validation
                    if not isinstance(data, dict) or "total_rank" not in data:
                        _global_circuit_breaker.record_failure()
                        return False, None, retry_count, "SCHEMA_VALIDATION_FAILED: Missing total_rank in response."
                    
                    _global_circuit_breaker.record_success()
                    return True, data, retry_count, None

                elif resp.status_code == 429:
                    retry_count += 1
                    retry_after = resp.headers.get("Retry-After")
                    wait_time = float(retry_after) if retry_after and retry_after.isdigit() else (2.0 ** attempt) + random.uniform(0.1, 0.5)
                    logger.warning(f"HTTP 429 Rate Limited on page {page} for {slug}. Backing off {wait_time:.2f}s...")
                    await asyncio.sleep(wait_time)

                else:
                    retry_count += 1
                    if attempt < max_retries:
                        wait_time = (1.5 ** attempt) + random.uniform(0.1, 0.3)
                        await asyncio.sleep(wait_time)

            except Exception as e:
                retry_count += 1
                logger.warning(f"Network error on page {page} for {slug} (Attempt {attempt + 1}): {e}")
                if attempt < max_retries:
                    await asyncio.sleep(1.0 + attempt)

        _global_circuit_breaker.record_failure()
        return False, None, retry_count, f"API_FETCH_FAILED: Failed to fetch page {page} after {max_retries} retries."

    @classmethod
    async def fetch_complete_validated_leaderboard(
        cls,
        slug: str
    ) -> Tuple[bool, List[Dict[str, Any]], Dict[str, Any]]:
        """
        Fetch the COMPLETE official leaderboard.
        Fail closed: if ANY page fails, return success=False.
        """
        # Removed hardcoded mock array for Weekly Contest 516
        all_entries: List[Dict[str, Any]] = []
        metadata = {
            "pages_requested": 0,
            "pages_successfully_fetched": 0,
            "total_reported": None,
            "total_fetched": 0,
            "unique_usernames": 0,
            "duplicate_count": 0,
            "retry_count": 0,
            "validation_status": "VERIFIED",
            "failure_reason": None
        }

        page = 1
        page_size = 25  # LeetCode default per page
        total_pages = 1
        seen_usernames: Set[str] = set()

        async with httpx.AsyncClient(timeout=15.0) as client:
            while page <= total_pages:
                metadata["pages_requested"] += 1
                success, data, retries, err_msg = await cls.fetch_leaderboard_page_with_retry(client, slug, page)
                metadata["retry_count"] += retries

                if not success:
                    metadata["validation_status"] = "LEADERBOARD_INCOMPLETE" if "SCHEMA" not in str(err_msg) else "SCHEMA_VALIDATION_FAILED"
                    metadata["failure_reason"] = f"Page {page}/{total_pages} fetch failed: {err_msg}"
                    logger.error(f"[PublicContestEngine] Leaderboard fetch failed on page {page} for {slug}: {err_msg}")
                    return False, [], metadata

                metadata["pages_successfully_fetched"] += 1
                
                # Verify contest identity if available in page 1
                if page == 1:
                    user_num = data.get("user_num", 0)
                    metadata["total_reported"] = user_num
                    if user_num > 0:
                        total_pages = max(1, (user_num + page_size - 1) // page_size)

                raw_entries = data.get("total_rank", [])
                submissions_map = data.get("submissions", [])

                if not raw_entries and page > 1:
                    # Completion condition reached early
                    break

                for idx, entry in enumerate(raw_entries):
                    # Use user_slug for canonical matching (survives username changes)
                    raw_uname = entry.get("user_slug") or entry.get("username")
                    if not raw_uname:
                        continue

                    norm_uname = cls.normalize_username(raw_uname)

                    # Duplicate detection
                    if norm_uname in seen_usernames:
                        metadata["duplicate_count"] += 1
                        continue
                    seen_usernames.add(norm_uname)

                    # Extract solved problems count from submission map
                    problems_solved = 0
                    if idx < len(submissions_map) and submissions_map[idx]:
                        sub_dict = submissions_map[idx]
                        problems_solved = len(sub_dict)

                    all_entries.append({
                        "username": entry.get("username"),
                        "user_slug": entry.get("user_slug"),
                        "normalized_username": norm_uname,
                        "rank": entry.get("rank"),
                        "score": entry.get("score", 0),
                        "finish_time": str(entry.get("finish_time", "")),
                        "problems_solved": problems_solved
                    })

                page += 1

        metadata["total_fetched"] = len(all_entries)
        metadata["unique_usernames"] = len(seen_usernames)

        # Final completeness condition check
        if metadata["pages_successfully_fetched"] < metadata["pages_requested"]:
            metadata["validation_status"] = "LEADERBOARD_INCOMPLETE"
            metadata["failure_reason"] = "Fetched pages count does not match requested pages count."
            return False, [], metadata

        return True, all_entries, metadata

    @classmethod
    async def sync_public_participants(
        cls,
        db: Session,
        session_id: int,
        force_resync: bool = False
    ) -> Tuple[bool, Dict[str, Any]]:
        """
        Execute full single-flight, fail-closed synchronization lifecycle:
        REQUESTED -> FETCHING -> VALIDATING -> COMPLETE -> NORMALIZING -> MATCHING -> VERIFIED -> PUBLISHED
        Supports Versioned Datasets & Distributed DB Lease Lock Recovery.
        """
        # Resolve weekly session
        session = db.query(WeeklySession).filter(WeeklySession.id == session_id).first()
        if not session:
            return False, {"error": f"WeeklySession with id {session_id} not found."}

        contest_slug = session.contest_id or f"weekly-contest-{session.week_number}"
        contest_slug = contest_slug.lower().strip()
        contest_title = session.contest_name or f"Weekly Contest {session.week_number}"

        # ─── DISTRIBUTED DB LEASE LOCK & STALE LOCK RECOVERY ───
        now_utc = datetime.now(timezone.utc)
        worker_id = f"worker_{uuid.uuid4().hex[:8]}"

        active_sync = db.query(PublicContestSyncAudit).filter(
            PublicContestSyncAudit.session_id == session_id,
            PublicContestSyncAudit.validation_status == "SYNC_IN_PROGRESS"
        ).first()

        if active_sync:
            # Check heartbeat timeout (120 seconds lease)
            if active_sync.heartbeat_at:
                lease_age = (now_utc - active_sync.heartbeat_at.replace(tzinfo=timezone.utc)).total_seconds()
                if lease_age < 120.0 and not force_resync:
                    logger.info(f"[PublicContestEngine] Distributed lock active for {contest_slug} (Owner: {active_sync.sync_owner}). Reusing active sync job.")
                    return True, {
                        "sync_id": active_sync.sync_id,
                        "session_id": session_id,
                        "contest_slug": contest_slug,
                        "validation_status": "SYNC_IN_PROGRESS",
                        "publish_status": "DO_NOT_PUBLISH",
                        "message": "Synchronization is currently in progress by another worker."
                    }
                else:
                    logger.warning(f"[PublicContestEngine] Recovered stale DB lock for {contest_slug} (Lease age: {lease_age:.1f}s). Taking over lease.")
                    active_sync.validation_status = "API_FETCH_FAILED"
                    active_sync.failure_reason = "Stale lock timeout: Previous sync worker timed out."
                    db.commit()

        # Process-local single-flight lock
        lock = await get_single_flight_lock(contest_slug)
        async with lock:
            sync_id = f"sync_{uuid.uuid4().hex[:12]}"
            started_at = datetime.now(timezone.utc)

            # 1. Check existing verified dataset & freshness
            existing_audit = db.query(PublicContestSyncAudit).filter(
                PublicContestSyncAudit.session_id == session_id,
                PublicContestSyncAudit.validation_status == "VERIFIED",
                PublicContestSyncAudit.publish_status == "PUBLISHED"
            ).order_by(PublicContestSyncAudit.id.desc()).first()

            if existing_audit and not force_resync:
                time_since_sync = (datetime.now(timezone.utc) - existing_audit.started_at.replace(tzinfo=timezone.utc)).total_seconds()
                if time_since_sync < 3600:
                    logger.info(f"[PublicContestEngine] Reusing FRESH cached dataset version {existing_audit.dataset_version} for {contest_slug}")
                    return True, {
                        "sync_id": existing_audit.sync_id,
                        "session_id": session_id,
                        "contest_slug": contest_slug,
                        "dataset_version": existing_audit.dataset_version,
                        "cache_state": "FRESH",
                        "status": "VERIFIED",
                        "matched_students": existing_audit.matched_students,
                        "publish_status": "PUBLISHED"
                    }

            # Create in-progress DB audit lock entry
            in_progress_audit = PublicContestSyncAudit(
                sync_id=sync_id,
                session_id=session_id,
                contest_id=str(session.id),
                contest_slug=contest_slug,
                contest_title=contest_title,
                started_at=started_at,
                source="official_leetcode_leaderboard",
                sync_owner=worker_id,
                heartbeat_at=started_at,
                lock_expiry=started_at + timedelta(seconds=120),
                circuit_breaker_state=_global_circuit_breaker.state,
                cache_state="FRESH",
                validation_status="SYNC_IN_PROGRESS",
                publish_status="DO_NOT_PUBLISH"
            )
            db.add(in_progress_audit)
            db.commit()

            # 2. Complete Leaderboard Fetching
            logger.info(f"[PublicContestEngine] Starting complete leaderboard fetch for {contest_slug}...")
            fetch_success, leaderboard_entries, meta = await cls.fetch_complete_validated_leaderboard(contest_slug)

            completed_at = datetime.now(timezone.utc)

            # Update audit record
            in_progress_audit.completed_at = completed_at
            in_progress_audit.pages_requested = meta["pages_requested"]
            in_progress_audit.pages_successfully_fetched = meta["pages_successfully_fetched"]
            in_progress_audit.total_reported = meta["total_reported"]
            in_progress_audit.total_fetched = meta["total_fetched"]
            in_progress_audit.unique_usernames = meta["unique_usernames"]
            in_progress_audit.duplicate_count = meta["duplicate_count"]
            in_progress_audit.retry_count = meta["retry_count"]
            in_progress_audit.circuit_breaker_state = _global_circuit_breaker.state
            in_progress_audit.cache_state = "FRESH" if fetch_success else "INVALID"
            in_progress_audit.validation_status = meta["validation_status"]
            in_progress_audit.publish_status = "PUBLISHED" if fetch_success else "KPT_LAST_VERIFIED"
            in_progress_audit.failure_reason = meta.get("failure_reason")

            # FAIL-CLOSED PROTECTION: If fetch failed, preserve last verified dataset version
            if not fetch_success:
                logger.error(f"[PublicContestEngine] Synchronization FAILED for {contest_slug}: {meta.get('failure_reason')}. Preserving last verified dataset version.")
                db.commit()
                return False, {
                    "sync_id": sync_id,
                    "session_id": session_id,
                    "contest_slug": contest_slug,
                    "validation_status": meta["validation_status"],
                    "publish_status": "KPT_LAST_VERIFIED",
                    "error": meta.get("failure_reason")
                }

            # 3. Compute Next Version Number (Versioned Dataset Architecture)
            max_ver = db.query(func.max(OfficialPublicParticipant.dataset_version)).filter(
                OfficialPublicParticipant.session_id == session_id
            ).scalar() or 0
            next_version = max_ver + 1
            in_progress_audit.dataset_version = next_version

            # 4. Exact Username Matching against Institutional Students
            students = db.query(Student).filter(Student.is_active == True).all()

            # Map normalized leaderboard usernames to entries
            leaderboard_map = {entry["normalized_username"]: entry for entry in leaderboard_entries}

            matched_records: List[OfficialPublicParticipant] = []
            missing_username_count = 0
            matched_count = 0

            for st in students:
                norm_user = cls.normalize_username(st.username)
                if not norm_user:
                    missing_username_count += 1
                    continue

                if norm_user in leaderboard_map:
                    entry = leaderboard_map[norm_user]
                    matched_count += 1
                    matched_records.append(OfficialPublicParticipant(
                        session_id=session_id,
                        contest_id=str(session.id),
                        contest_slug=contest_slug,
                        contest_title=contest_title,
                        student_id=st.id,
                        leetcode_username=st.username or norm_user,
                        official_rank=entry["rank"],
                        official_problems_solved=entry["problems_solved"],
                        official_score=entry["score"],
                        official_finish_time=entry["finish_time"],
                        source="official_leetcode_leaderboard",
                        verification_status="VERIFIED",
                        dataset_version=next_version,
                        is_active_version=True,
                        sync_timestamp=completed_at
                    ))

            in_progress_audit.matched_students = matched_count
            in_progress_audit.missing_username_count = missing_username_count

            # 5. Versioned Dataset Atomic Transaction Swap
            try:
                # Mark previous active version records as SUPERSEDED (is_active_version = False)
                db.query(OfficialPublicParticipant).filter(
                    OfficialPublicParticipant.session_id == session_id,
                    OfficialPublicParticipant.is_active_version == True
                ).update({"is_active_version": False}, synchronize_session=False)

                # Bulk insert new active version records
                if matched_records:
                    db.bulk_save_objects(matched_records)
                
                db.commit()
                logger.info(f"[PublicContestEngine] Successfully published Version {next_version} ({matched_count} participants) for {contest_slug} (Sync ID: {sync_id}).")
            except SQLAlchemyError as e:
                db.rollback()
                logger.error(f"[PublicContestEngine] DB Error during atomic versioned publishing: {e}")
                in_progress_audit.publish_status = "DO_NOT_PUBLISH"
                in_progress_audit.validation_status = "VERIFICATION_REQUIRED"
                in_progress_audit.failure_reason = f"Database transaction failed: {e}"
                db.add(in_progress_audit)
                db.commit()
                return False, {"error": f"Database transaction failed: {e}"}

            return True, {
                "sync_id": sync_id,
                "session_id": session_id,
                "contest_slug": contest_slug,
                "dataset_version": next_version,
                "validation_status": "VERIFIED",
                "publish_status": "PUBLISHED",
                "total_reported": meta["total_reported"],
                "total_fetched": meta["total_fetched"],
                "unique_usernames": meta["unique_usernames"],
                "matched_students": matched_count,
                "missing_usernames": missing_username_count,
                "duplicate_count": meta["duplicate_count"]
            }

    @classmethod
    def get_public_participants_role_scoped(
        cls,
        db: Session,
        session_id: int,
        current_user: Any,
        department_id: Optional[int] = None,
        year_level: Optional[str] = None,
        section_id: Optional[int] = None,
        search: Optional[str] = None,
        page: int = 1,
        page_size: int = 50
    ) -> Dict[str, Any]:
        """
        Role-scoped server-side query for Public Participants (Active Dataset Version Only).
        - Staff: Assigned students ONLY.
        - HOD: Authorized department ONLY.
        - Student: Self ONLY.
        - Admin / Principal: Full institutional access.
        """
        authorized_ids = get_authorized_student_ids(db, current_user)

        st_query = db.query(Student).outerjoin(Student.department).outerjoin(Student.section).filter(
            (Student.is_active == True) | (Student.is_active.is_(None))
        )

        if authorized_ids is not None:
            if not authorized_ids:
                return {
                    "total": 0,
                    "page": page,
                    "page_size": page_size,
                    "public_participants": [],
                    "unfound_students": [],
                    "summary": {
                        "total_institutional_students": 0,
                        "public_participants_count": 0,
                        "not_found_count": 0,
                        "missing_username_count": 0,
                        "public_participation_pct": 0.0
                    }
                }
            st_query = st_query.filter(Student.id.in_(authorized_ids))

        # Apply filters
        if department_id:
            st_query = st_query.filter(Student.department_id == department_id)
        if year_level:
            st_query = st_query.filter(Student.year_level == year_level)
        if section_id:
            st_query = st_query.filter(Student.section_id == section_id)
        if search:
            search_pattern = f"%{search.strip()}%"
            st_query = st_query.filter(
                (Student.name.ilike(search_pattern)) |
                (Student.reg_no.ilike(search_pattern)) |
                (Student.username.ilike(search_pattern))
            )

        all_students = st_query.all()
        student_ids = [s.id for s in all_students]

        if not student_ids:
            return {
                "total": 0,
                "page": page,
                "page_size": page_size,
                "public_participants": [],
                "unfound_students": [],
                "summary": {
                    "total_institutional_students": 0,
                    "public_participants_count": 0,
                    "not_found_count": 0,
                    "missing_username_count": 0,
                    "public_participation_pct": 0.0
                }
            }

        # Query ACTIVE VERSION of public participation records ONLY
        participations = db.query(OfficialPublicParticipant).filter(
            OfficialPublicParticipant.session_id == session_id,
            OfficialPublicParticipant.is_active_version == True,
            OfficialPublicParticipant.student_id.in_(student_ids)
        ).all()

        pub_map = {p.student_id: p for p in participations}

        # Query WeeklyPublicResult fallback
        from backend.models import WeeklyPublicResult
        weekly_results = db.query(WeeklyPublicResult).filter(
            WeeklyPublicResult.session_id == session_id,
            WeeklyPublicResult.student_id.in_(student_ids),
            WeeklyPublicResult.total_contest_solved > 0
        ).all()
        
        fallback_map = {w.student_id: w for w in weekly_results}

        public_list = []
        unfound_list = []
        missing_user_count = 0

        for st in all_students:
            has_username = bool(st.username and st.username.strip())
            if not has_username:
                missing_user_count += 1

            st_dict = {
                "student_id": st.id,
                "student_name": st.name,
                "register_number": st.reg_no,
                "department": st.department.code if st.department else "CSE",
                "year": st.year_level,
                "section": st.section.name if st.section else "A",
                "leetcode_username": st.username or "MISSING",
                "has_username": has_username
            }

            if st.id in pub_map:
                p = pub_map[st.id]
                st_dict.update({
                    "contest_rank": p.official_rank,
                    "problems_solved": p.official_problems_solved,
                    "score": p.official_score,
                    "finish_time": p.official_finish_time,
                    "contest_slug": p.contest_slug,
                    "contest_title": p.contest_title,
                    "dataset_version": p.dataset_version,
                    "verification_status": p.verification_status,
                    "status": "PUBLIC_PARTICIPANT"
                })
                public_list.append(st_dict)
            elif st.id in fallback_map:
                # Merge the fallback data
                w = fallback_map[st.id]
                st_dict.update({
                    "contest_rank": w.contest_rank or "-",
                    "problems_solved": w.total_contest_solved,
                    "score": w.contest_score,
                    "finish_time": 0,
                    "contest_slug": "weekly-contest",
                    "contest_title": "Weekly Contest",
                    "dataset_version": "graphql_fallback",
                    "verification_status": "VERIFIED_VIA_GRAPHQL",
                    "status": "PUBLIC_PARTICIPANT"
                })
                public_list.append(st_dict)
            else:
                st_dict.update({
                    "verification_status": "MISSING_LEETCODE_USERNAME" if not has_username else "NOT_FOUND_IN_PUBLIC_LEADERBOARD",
                    "status": "NOT_FOUND_IN_PUBLIC_LEADERBOARD"
                })
                unfound_list.append(st_dict)

        total_students_count = len(all_students)
        public_count = len(public_list)
        not_found_count = len(unfound_list)
        pct = round((public_count / total_students_count) * 100.0, 2) if total_students_count > 0 else 0.0

        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        paginated_public = public_list[start_idx:end_idx]

        return {
            "total": total_students_count,
            "page": page,
            "page_size": page_size,
            "public_participants": paginated_public,
            "unfound_students": unfound_list,
            "summary": {
                "total_institutional_students": total_students_count,
                "public_participants_count": public_count,
                "not_found_count": not_found_count,
                "missing_username_count": missing_user_count,
                "public_participation_pct": pct
            }
        }
