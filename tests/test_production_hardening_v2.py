import pytest
import datetime
import asyncio
import time
from sqlalchemy.exc import OperationalError, InternalError
from backend.services.token_bucket_limiter import (
    TokenBucketRateLimiter,
    SourceRateLimitExhaustedError,
    SourceUnavailableError,
    SourceMalformedResponseError
)
from backend.database import SessionLocal, engine
from backend.models import OfficialWeeklySnapshot, WeeklySession, WeeklyPublicResult, Student
from backend.services.weekly_session_manager import (
    snapshot_supersedes,
    get_active_verification_windows,
    sweep_bounded_verification_windows,
    VERIFICATION_WINDOW_DAYS
)
from backend.services.canonical_contest_engine import build_canonical_contest_dataset

# ==============================================================================
# 1. RATE LIMITING TESTS (Token Bucket + Backoff + Jitter + 429 Handling)
# ==============================================================================

def test_token_bucket_rate_limiter_acquisition():
    """Verifies token bucket correctly meters token consumption."""
    async def _run():
        limiter = TokenBucketRateLimiter(rate_per_sec=10.0, capacity=2.0, max_concurrent=2)
        start = time.monotonic()
        for _ in range(4):
            await limiter.acquire_token()
        duration = time.monotonic() - start
        assert duration >= 0.1

    asyncio.run(_run())

def test_rate_limiter_handles_simulated_429_backoff():
    """Verifies exponential backoff and retry exhaustion on simulated HTTP 429."""
    async def _run():
        limiter = TokenBucketRateLimiter(rate_per_sec=20.0, capacity=5.0, max_concurrent=5)
        call_counts = {"attempts": 0}

        class Mock429Exception(Exception):
            def __init__(self):
                super().__init__("HTTP 429: Too Many Requests")
                self.status_code = 429

        def failing_request():
            call_counts["attempts"] += 1
            raise Mock429Exception()

        with pytest.raises(SourceRateLimitExhaustedError) as exc_info:
            await limiter.execute(
                failing_request,
                student_handle="test_student",
                max_retries=3,
                base_backoff_sec=0.01,
                max_backoff_sec=0.05
            )

        assert call_counts["attempts"] == 3
        assert "Rate limit exhausted" in str(exc_info.value)
        assert exc_info.value.status_code == 429

    asyncio.run(_run())


# ==============================================================================
# 2. SNAPSHOT IMMUTABILITY TESTS (DB-Level Trigger & snapshot_supersedes)
# ==============================================================================

def test_database_trigger_prevents_snapshot_in_place_mutation():
    """
    Verifies the SQLite database trigger aborts any in-place UPDATE to a finalized snapshot.
    """
    db = SessionLocal()
    temp_session = None
    snap = None
    try:
        now_dt = datetime.datetime.utcnow()
        temp_session = WeeklySession(
            academic_year="2026-27",
            session_code=f"WEEK-TEST-TRIGGER-{int(time.time())}",
            session_date="23.08.2026",
            contest_id="weekly-contest-trigger-test",
            contest_name="Trigger Test Contest",
            status="FINALIZED",
            total_students=302
        )
        db.add(temp_session)
        db.commit()
        db.refresh(temp_session)

        snap = OfficialWeeklySnapshot(
            session_id=temp_session.id,
            contest_id="weekly-contest-trigger-test",
            contest_name="Trigger Test Contest",
            contest_date="23.08.2026",
            finalized_at=now_dt,
            dataset={"metrics": {"totalStudents": 302}},
            dataset_hash="test_initial_hash_12345",
            student_count=302,
            error_count=0,
            is_superseded=False
        )
        db.add(snap)
        db.commit()
        db.refresh(snap)

        # Attempt in-place UPDATE via raw SQL to test trigger abort
        with pytest.raises(Exception) as exc_info:
            with engine.connect() as conn:
                conn.execute(
                    __import__('sqlalchemy').text(
                        f"UPDATE official_weekly_snapshots SET dataset_hash = 'corrupted_hash' WHERE id = {snap.id}"
                    )
                )
                conn.commit()

        err_msg = str(exc_info.value).upper()
        assert "SNAPSHOT_IMMUTABLE" in err_msg or "ABORT" in err_msg
    finally:
        if snap:
            try:
                db.delete(snap)
                db.commit()
            except Exception:
                pass
        if temp_session:
            try:
                db.delete(temp_session)
                db.commit()
            except Exception:
                pass
        db.close()

def test_snapshot_supersedes_creates_new_row_and_preserves_provenance():
    """
    Verifies that snapshot_supersedes() creates a new snapshot row without
    violating immutability constraints, and links old row as superseded.
    """
    db = SessionLocal()
    temp_session = None
    snap1 = None
    snap2 = None
    try:
        now_dt = datetime.datetime.utcnow()
        temp_session = WeeklySession(
            academic_year="2026-27",
            session_code=f"WEEK-TEST-SUPER-{int(time.time())}",
            session_date="23.08.2026",
            contest_id="weekly-contest-super-test",
            contest_name="Weekly Contest Super Test",
            status="FINALIZED",
            total_students=302
        )
        db.add(temp_session)
        db.commit()
        db.refresh(temp_session)

        snap1 = OfficialWeeklySnapshot(
            session_id=temp_session.id,
            contest_id="weekly-contest-super-test",
            contest_name="Weekly Contest Super Test",
            contest_date="23.08.2026",
            finalized_at=now_dt,
            dataset={"metrics": {"totalStudents": 302, "officialAttended": 99}},
            dataset_hash="hash_v1_original",
            student_count=302,
            error_count=0,
            is_superseded=False
        )
        db.add(snap1)
        db.commit()
        db.refresh(snap1)

        # Execute snapshot superseding
        new_data = {
            "contestId": "weekly-contest-super-test",
            "contestName": "Weekly Contest Super Test",
            "sessionDate": "23.08.2026",
            "metrics": {"totalStudents": 302, "officialAttended": 100, "dataErrors": 0}
        }
        snap2 = snapshot_supersedes(snap1.id, new_data, db)

        db.refresh(snap1)
        db.refresh(snap2)

        # Assertions
        assert snap1.is_superseded is True
        assert snap1.superseded_by_id == snap2.id
        assert snap1.dataset_hash == "hash_v1_original"  # Preserved original hash
        assert snap2.is_superseded is False
        assert snap2.id != snap1.id
    finally:
        if snap2:
            try:
                db.delete(snap2)
                db.commit()
            except Exception:
                pass
        if snap1:
            try:
                db.delete(snap1)
                db.commit()
            except Exception:
                pass
        if temp_session:
            try:
                db.delete(temp_session)
                db.commit()
            except Exception:
                pass
        db.close()


# ==============================================================================
# 3. BOUNDED VERIFICATION WINDOW & NOT_VERIFIED_FINAL TESTS
# ==============================================================================

def test_active_verification_windows_observability():
    """Verifies that active verification windows are calculated and exposed."""
    db = SessionLocal()
    try:
        windows = get_active_verification_windows(db)
        assert isinstance(windows, list)
        for w in windows:
            assert "sessionId" in w
            assert "contestName" in w
            assert "contestEndIso" in w
            assert "verificationWindowEndIso" in w
            assert "isWindowActive" in w
            assert "daysRemaining" in w
    finally:
        db.close()


# ==============================================================================
# 4. DATA ERRORS CONTRACT & CONFIDENCE TIER TESTS
# ==============================================================================

def test_data_errors_contract_equals_conflict_plus_source_error():
    """
    Guarantees the strict contract:
    Data Errors = count(CONFLICT) + count(SOURCE_ERROR)
    NOT_VERIFIED and NOT_VERIFIED_FINAL are NOT counted as errors.
    """
    db = SessionLocal()
    try:
        session = db.query(WeeklySession).first()
        if not session:
            pytest.skip("No session available.")

        dataset = build_canonical_contest_dataset(session.id, db)
        metrics = dataset.get("metrics", {})

        conflict_cnt = metrics.get("conflict", 0)
        source_err_cnt = metrics.get("sourceError", 0)
        total_errors = metrics.get("totalErrors", 0)

        # Contract assertion
        assert total_errors == conflict_cnt + source_err_cnt

        # Invariant: Total = Public + Virtual + NotAttended + NotVerified + NotVerifiedFinal + Errors
        total_students = metrics.get("totalStudents", 0)
        public_cnt = metrics.get("public", 0)
        virtual_cnt = metrics.get("virtual", 0)
        not_att_cnt = metrics.get("notAttended", 0)
        not_verified_cnt = metrics.get("notVerified", 0)
        not_verified_final_cnt = metrics.get("notVerifiedFinal", 0)

        assert total_students == (
            public_cnt + virtual_cnt + not_att_cnt + not_verified_cnt + not_verified_final_cnt + total_errors
        )
    finally:
        db.close()
