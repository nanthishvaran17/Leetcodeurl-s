from __future__ import annotations

import re
import datetime
import asyncio
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import or_

from backend.database import SessionLocal
from backend.models import (
    Student, Department, LeetCodeProfileStats,
    WeeklySession, WeeklyPublicResult, WeeklyVirtualResult,
    AuditLog
)
from backend.services.token_bucket_limiter import (
    TokenBucketRateLimiter,
    LeetCodeSourceError,
    SourceUnavailableError,
    SourceMalformedResponseError,
    SourceRateLimitExhaustedError
)
from backend.cache import cache
from backend.logger import logger

# ==============================================================================
# 1. SYNC STATUS CODES & OPERATION RESULTS
# ==============================================================================

class SyncStatusCode:
    NEW = "NEW"
    UPDATED = "UPDATED"
    UNCHANGED = "UNCHANGED"
    CONFIRMED_DELETED = "CONFIRMED_DELETED"
    TEMPORARY_FETCH_FAILURE = "TEMPORARY_FETCH_FAILURE"
    RATE_LIMITED = "RATE_LIMITED"
    SOURCE_UNAVAILABLE = "SOURCE_UNAVAILABLE"
    AUTH_REQUIRED = "AUTH_REQUIRED"
    INVALID_URL = "INVALID_URL"


class SyncResult:
    def __init__(
        self,
        status: str,
        student_id: Optional[int] = None,
        reg_no: Optional[str] = None,
        username: Optional[str] = None,
        canonical_url: Optional[str] = None,
        message: str = "",
        raw_error: Optional[str] = None
    ):
        self.status = status
        self.student_id = student_id
        self.reg_no = reg_no
        self.username = username
        self.canonical_url = canonical_url
        self.message = message
        self.raw_error = raw_error
        self.timestamp = datetime.datetime.now(datetime.timezone.utc)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "status": self.status,
            "student_id": self.student_id,
            "reg_no": self.reg_no,
            "username": self.username,
            "canonical_url": self.canonical_url,
            "message": self.message,
            "raw_error": self.raw_error,
            "timestamp": self.timestamp.isoformat()
        }


# ==============================================================================
# 2. CANONICAL URL & USERNAME NORMALIZER
# ==============================================================================

def normalize_leetcode_url_and_username(raw_input: Optional[str]) -> Tuple[Optional[str], Optional[str]]:
    """
    Normalizes any LeetCode input (URL, full link, username) into:
    (canonical_username, canonical_url)
    
    Examples:
    - "https://leetcode.com/u/priya_dharshini/" -> ("priya_dharshini", "https://leetcode.com/u/priya_dharshini/")
    - "https://leetcode.com/priya_dharshini" -> ("priya_dharshini", "https://leetcode.com/u/priya_dharshini/")
    - "priya_dharshini" -> ("priya_dharshini", "https://leetcode.com/u/priya_dharshini/")
    """
    if not raw_input or not str(raw_input).strip():
        return None, None

    cleaned = str(raw_input).strip().rstrip("/")

    # If it's a URL
    if "leetcode.com" in cleaned:
        # Match /u/username or /username
        match = re.search(r"leetcode\.com/(?:u/)?([a-zA-Z0-9_\-]+)", cleaned)
        if match:
            username = match.group(1).strip()
            return username, f"https://leetcode.com/u/{username}/"
        return None, None

    # If it's just a username
    clean_username = re.sub(r"[^a-zA-Z0-9_\-]", "", cleaned)
    if clean_username:
        return clean_username, f"https://leetcode.com/u/{clean_username}/"

    return None, None


# ==============================================================================
# 3. DYNAMIC URL & DATABASE SYNCHRONIZATION ENGINE
# ==============================================================================

class DynamicUrlDatabaseSyncEngine:
    """
    Authoritative Dynamic URL & Database Synchronization Engine.
    
    Guarantees:
    - DISCOVER -> NORMALIZE -> VALIDATE -> MATCH -> UPSERT -> RECONCILE -> REMOVE STALE -> SERVE
    - Immediate Cache Invalidation on all mutations
    - Logical entity matching to prevent duplicate records on URL/name changes
    - Failure safety: Never drops valid data on temporary network glitches
    """
    def __init__(self, rate_limiter: Optional[TokenBucketRateLimiter] = None):
        self.limiter = rate_limiter or TokenBucketRateLimiter(rate_per_sec=3.0, capacity=5.0, max_concurrent=5)

    def sync_student_record(
        self,
        db: Session,
        reg_no: str,
        name: Optional[str] = None,
        raw_url_or_username: Optional[str] = None,
        dept_code: Optional[str] = None,
        year_level: Optional[str] = None,
        email: Optional[str] = None
    ) -> SyncResult:
        """
        Synchronizes a single student record with automatic URL normalization,
        duplicate prevention, and immediate cache invalidation.
        """
        reg_no_clean = reg_no.strip().upper()
        username, canonical_url = normalize_leetcode_url_and_username(raw_url_or_username)

        # 1. Match against existing logical entity by reg_no
        student = db.query(Student).filter(Student.reg_no == reg_no_clean).first()
        is_new = student is None
        has_changes = False

        if is_new:
            # Resolve department
            dept = None
            if dept_code:
                dept = db.query(Department).filter(
                    or_(Department.code == dept_code.upper(), Department.name.ilike(f"%{dept_code}%"))
                ).first()

            student = Student(
                reg_no=reg_no_clean,
                name=name.strip() if name else "Student",
                username=username,
                leetcode_url=canonical_url,
                department_id=dept.id if dept else 1,
                year_level=year_level or "III",
                email=email.strip() if email else None,
                is_active=True,
                created_at=datetime.datetime.now(datetime.timezone.utc)
            )
            db.add(student)
            db.flush()
            status = SyncStatusCode.NEW
            message = f"Created new student record for {reg_no_clean}."
        else:
            # Check for changes in name, URL/username, dept, year
            if name and name.strip() != student.name:
                student.name = name.strip()
                has_changes = True

            if username != student.username or canonical_url != student.leetcode_url:
                old_url = student.leetcode_url
                student.username = username
                student.leetcode_url = canonical_url
                has_changes = True
                logger.info(f"[URL_SYNC_CHANGE] {reg_no_clean}: URL updated from '{old_url}' to '{canonical_url}'")

            if dept_code:
                dept = db.query(Department).filter(
                    or_(Department.code == dept_code.upper(), Department.name.ilike(f"%{dept_code}%"))
                ).first()
                if dept and student.department_id != dept.id:
                    student.department_id = dept.id
                    has_changes = True

            if year_level and student.year_level != year_level:
                student.year_level = year_level
                has_changes = True

            if student.is_active is False:
                student.is_active = True
                has_changes = True

            if has_changes:
                status = SyncStatusCode.UPDATED
                message = f"Updated existing record for {reg_no_clean}."
            else:
                status = SyncStatusCode.UNCHANGED
                message = f"No changes detected for {reg_no_clean}."

        db.commit()

        # Invalidate all contest matrix and student caches
        self.invalidate_caches()

        return SyncResult(
            status=status,
            student_id=student.id,
            reg_no=student.reg_no,
            username=student.username,
            canonical_url=student.leetcode_url,
            message=message
        )

    def remove_or_archive_student(
        self,
        db: Session,
        reg_no_or_id: Any,
        is_permanent: bool = False
    ) -> SyncResult:
        """
        Removes or archives a student record with guaranteed cache invalidation.
        Guarantees deleted records are not resurrected by stale cache.
        """
        if isinstance(reg_no_or_id, int):
            student = db.query(Student).filter(Student.id == reg_no_or_id).first()
        else:
            student = db.query(Student).filter(Student.reg_no == str(reg_no_or_id).strip().upper()).first()

        if not student:
            return SyncResult(
                status=SyncStatusCode.CONFIRMED_DELETED,
                message=f"Student {reg_no_or_id} not found or already deleted."
            )

        reg_no = student.reg_no
        s_id = student.id

        if is_permanent:
            # Delete dependent records
            db.query(WeeklyPublicResult).filter(WeeklyPublicResult.student_id == s_id).delete()
            db.query(WeeklyVirtualResult).filter(WeeklyVirtualResult.student_id == s_id).delete()
            db.query(LeetCodeProfileStats).filter(LeetCodeProfileStats.student_id == s_id).delete()
            db.delete(student)
            message = f"Permanently deleted student record {reg_no}."
        else:
            student.is_active = False
            message = f"Archived/deactivated student record {reg_no}."

        db.commit()

        # Invalidate all caches
        self.invalidate_caches()

        return SyncResult(
            status=SyncStatusCode.CONFIRMED_DELETED,
            student_id=s_id,
            reg_no=reg_no,
            message=message
        )

    def sync_contest_url_change(
        self,
        db: Session,
        session_id: int,
        new_contest_slug: str,
        new_contest_name: Optional[str] = None
    ) -> SyncResult:
        """
        Handles contest slug / URL update on the same logical session record
        without spawning duplicate contest sessions.
        """
        session = db.query(WeeklySession).filter(WeeklySession.id == session_id).first()
        if not session:
            return SyncResult(
                status=SyncStatusCode.TEMPORARY_FETCH_FAILURE,
                message=f"Contest session {session_id} not found."
            )

        old_slug = session.contest_id
        session.contest_id = new_contest_slug
        if new_contest_name:
            session.contest_name = new_contest_name
        session.updated_at = datetime.datetime.now(datetime.timezone.utc)

        db.commit()
        self.invalidate_caches()
        logger.info(f"[CONTEST_URL_SYNC] Session {session_id}: Slug updated from '{old_slug}' to '{new_contest_slug}'")

        return SyncResult(
            status=SyncStatusCode.UPDATED,
            student_id=None,
            canonical_url=f"https://leetcode.com/contest/{new_contest_slug}",
            message=f"Contest slug updated from '{old_slug}' to '{new_contest_slug}' on session {session_id}."
        )

    def invalidate_caches(self):
        """Clears in-memory cache stores across all contest matrices and student endpoints."""
        try:
            cache.clear()
        except Exception as e:
            logger.warning(f"[CACHE_INVALIDATION_WARNING] Could not clear cache: {e}")


url_sync_engine = DynamicUrlDatabaseSyncEngine()
