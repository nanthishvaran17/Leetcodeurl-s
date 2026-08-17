"""
Tests for fetch_verified_student_contest_record multi-stage verification pipeline.

Cases verified:
 1. Source unavailable (rate-limited) → SOURCE_UNAVAILABLE, solvedCount=None
 2. Valid profile, contest not in history → NOT_PARTICIPATED, DIRECT confidence=1.0
 3. Entry in history but attended=False → NOT_PARTICIPATED, DIRECT confidence=1.0
 4. Attended PUBLIC, only Stage 1 data → PARTICIPATED, DIRECT, confidence=0.95
 5. Attended PUBLIC, L2 cross-verified (slugs match) → CROSS_VERIFIED, confidence=0.99
 6. VIRTUAL mode, problem submission found → PARTICIPATED VIRTUAL, DIRECT, confidence=0.90
 7. VIRTUAL mode, no submission found → NOT_PARTICIPATED VIRTUAL, DIRECT, confidence=0.90
 8. Invalid username (empty) → base record with error, UNVERIFIED

Regression rules:
 R1. solvedCount is NEVER assumed (no guessing from total_solved or capability)
 R2. totalProblems always reflects fetched metadata (not hardcoded 4)
 R3. VIRTUAL and PUBLIC participation are always stored as separate records
 R4. UNKNOWN status is returned when evidence is insufficient
 R5. NOT_PARTICIPATED is only set when evidence confirms absence
"""
import asyncio
import datetime
import unittest
from unittest.mock import AsyncMock, patch

from backend.leetcode_fetcher import fetch_verified_student_contest_record


# ── Helpers ──────────────────────────────────────────────────────────────────

def _run(coro):
    return asyncio.run(coro)


def _make_contest_meta(*, total=4, slugs=None, start_ts=None, end_ts=None):
    slugs = slugs or ["problem-a", "problem-b", "problem-c", "problem-d"]
    return {
        "contestId": "weekly-contest-420",
        "contestSlug": "weekly-contest-420",
        "contestName": "Weekly Contest 420",
        "contestStartTime": start_ts,
        "contestEndTime": end_ts,
        "problemIds": [str(i) for i in range(total)],
        "problemSlugs": slugs[:total],
        "totalProblems": total,
        "status": "VERIFIED",
    }


def _make_contest_data_ok(history):
    return {"status": "ok", "data": {"history": history}}


def _make_subs_ok(submissions):
    return {"status": "ok", "data": {"submissions": submissions}}


_SLUG = "weekly-contest-420"
_USER = "test_user_abc"


# ── Test Suite ────────────────────────────────────────────────────────────────

class TestFetchVerifiedStudentContestRecord(unittest.TestCase):

    # Case 1: Source unavailable (rate-limited)
    def test_case1_source_unavailable_returns_source_unavailable_status(self):
        async def _inner():
            with patch("backend.leetcode_fetcher.fetch_contest_metadata", new_callable=AsyncMock) as m_meta, \
                 patch("backend.leetcode_fetcher.fetch_contest_data", new_callable=AsyncMock) as m_cd:
                m_meta.return_value = _make_contest_meta()
                m_cd.return_value = {"status": "rate_limited"}
                return await fetch_verified_student_contest_record(_USER, _SLUG, "PUBLIC")

        result = _run(_inner())
        self.assertEqual(result["participationStatus"], "SOURCE_UNAVAILABLE")
        self.assertIsNone(result["solvedCount"])
        self.assertEqual(result["verificationLevel"], "UNVERIFIED")

    # Case 2: Contest not in history → NOT_PARTICIPATED
    def test_case2_not_in_history_returns_not_participated(self):
        async def _inner():
            with patch("backend.leetcode_fetcher.fetch_contest_metadata", new_callable=AsyncMock) as m_meta, \
                 patch("backend.leetcode_fetcher.fetch_contest_data", new_callable=AsyncMock) as m_cd:
                m_meta.return_value = _make_contest_meta()
                m_cd.return_value = _make_contest_data_ok([
                    {"contest_name": "Weekly Contest 419", "attended": True,
                     "problems_solved": 2, "contest_rank": 5000, "finish_time_seconds": 3200}
                ])
                return await fetch_verified_student_contest_record(_USER, _SLUG, "PUBLIC")

        result = _run(_inner())
        self.assertEqual(result["participationStatus"], "NOT_PARTICIPATED")
        self.assertEqual(result["participationType"], "PUBLIC")
        self.assertEqual(result["verificationLevel"], "DIRECT")
        self.assertAlmostEqual(result["confidence"], 1.0)
        self.assertIsNone(result["solvedCount"])

    # Case 3: attended=False → NOT_PARTICIPATED
    def test_case3_attended_false_returns_not_participated(self):
        async def _inner():
            with patch("backend.leetcode_fetcher.fetch_contest_metadata", new_callable=AsyncMock) as m_meta, \
                 patch("backend.leetcode_fetcher.fetch_contest_data", new_callable=AsyncMock) as m_cd:
                m_meta.return_value = _make_contest_meta()
                m_cd.return_value = _make_contest_data_ok([
                    {"contest_name": "Weekly Contest 420", "attended": False,
                     "problems_solved": 0, "contest_rank": None, "finish_time_seconds": 0}
                ])
                return await fetch_verified_student_contest_record(_USER, _SLUG, "PUBLIC")

        result = _run(_inner())
        self.assertEqual(result["participationStatus"], "NOT_PARTICIPATED")
        self.assertEqual(result["verificationLevel"], "DIRECT")
        self.assertAlmostEqual(result["confidence"], 1.0)
        self.assertIsNone(result["solvedCount"])

    # Case 4: Attended PUBLIC, L2 unavailable → DIRECT, 0.95
    def test_case4_attended_public_no_l2_returns_direct(self):
        async def _inner():
            with patch("backend.leetcode_fetcher.fetch_contest_metadata", new_callable=AsyncMock) as m_meta, \
                 patch("backend.leetcode_fetcher.fetch_contest_data", new_callable=AsyncMock) as m_cd, \
                 patch("backend.leetcode_fetcher.fetch_recent_submissions", new_callable=AsyncMock) as m_subs:
                m_meta.return_value = _make_contest_meta()
                m_cd.return_value = _make_contest_data_ok([
                    {"contest_name": "Weekly Contest 420", "attended": True,
                     "problems_solved": 3, "contest_rank": 8000, "finish_time_seconds": 4800}
                ])
                m_subs.return_value = {"status": "error"}
                return await fetch_verified_student_contest_record(_USER, _SLUG, "PUBLIC")

        result = _run(_inner())
        self.assertEqual(result["participationStatus"], "PARTICIPATED")
        self.assertEqual(result["participationType"], "PUBLIC")
        self.assertEqual(result["solvedCount"], 3)
        self.assertEqual(result["verificationLevel"], "DIRECT")
        self.assertAlmostEqual(result["confidence"], 0.95)

    # Case 5: Attended PUBLIC, L2 cross-verified → CROSS_VERIFIED, 0.99
    def test_case5_attended_public_cross_verified(self):
        slugs = ["problem-a", "problem-b", "problem-c", "problem-d"]
        start_dt = datetime.datetime(2024, 1, 6, 2, 30, 0, tzinfo=datetime.timezone.utc)
        end_dt = datetime.datetime(2024, 1, 6, 4, 0, 0, tzinfo=datetime.timezone.utc)

        async def _inner():
            with patch("backend.leetcode_fetcher.fetch_contest_metadata", new_callable=AsyncMock) as m_meta, \
                 patch("backend.leetcode_fetcher.fetch_contest_data", new_callable=AsyncMock) as m_cd, \
                 patch("backend.leetcode_fetcher.fetch_recent_submissions", new_callable=AsyncMock) as m_subs:
                m_meta.return_value = _make_contest_meta(slugs=slugs, start_ts=start_dt, end_ts=end_dt)
                m_cd.return_value = _make_contest_data_ok([
                    {"contest_name": "Weekly Contest 420", "attended": True,
                     "problems_solved": 2, "contest_rank": 5500, "finish_time_seconds": 3600}
                ])
                sub_a_ts = datetime.datetime(2024, 1, 6, 2, 45, 0, tzinfo=datetime.timezone.utc)
                sub_b_ts = datetime.datetime(2024, 1, 6, 3, 10, 0, tzinfo=datetime.timezone.utc)
                m_subs.return_value = _make_subs_ok([
                    {"title_slug": "problem-a", "submission_timestamp": sub_a_ts},
                    {"title_slug": "problem-b", "submission_timestamp": sub_b_ts},
                ])
                return await fetch_verified_student_contest_record(_USER, _SLUG, "PUBLIC")

        result = _run(_inner())
        self.assertEqual(result["participationStatus"], "PARTICIPATED")
        self.assertEqual(result["participationType"], "PUBLIC")
        self.assertEqual(result["solvedCount"], 2)
        self.assertEqual(result["verificationLevel"], "CROSS_VERIFIED")
        self.assertAlmostEqual(result["confidence"], 0.99)
        self.assertIn("problem-a", result["solvedProblems"])
        self.assertIn("problem-b", result["solvedProblems"])

    # Case 6: VIRTUAL with submissions → PARTICIPATED VIRTUAL
    def test_case6_virtual_mode_with_submissions(self):
        slugs = ["problem-a", "problem-b", "problem-c", "problem-d"]

        async def _inner():
            with patch("backend.leetcode_fetcher.fetch_contest_metadata", new_callable=AsyncMock) as m_meta, \
                 patch("backend.leetcode_fetcher.fetch_contest_data", new_callable=AsyncMock) as m_cd, \
                 patch("backend.leetcode_fetcher.fetch_recent_submissions", new_callable=AsyncMock) as m_subs:
                m_meta.return_value = _make_contest_meta(slugs=slugs)
                m_cd.return_value = _make_contest_data_ok([])
                m_subs.return_value = _make_subs_ok([
                    {"title_slug": "problem-a", "submission_timestamp": None},
                    {"title_slug": "problem-c", "submission_timestamp": None},
                ])
                return await fetch_verified_student_contest_record(_USER, _SLUG, "VIRTUAL")

        result = _run(_inner())
        self.assertEqual(result["participationStatus"], "PARTICIPATED")
        self.assertEqual(result["participationType"], "VIRTUAL")
        self.assertEqual(result["solvedCount"], 2)
        self.assertEqual(result["verificationLevel"], "DIRECT")
        self.assertAlmostEqual(result["confidence"], 0.90)

    # Case 7: VIRTUAL, no submissions → NOT_PARTICIPATED VIRTUAL
    def test_case7_virtual_mode_no_submissions(self):
        slugs = ["problem-a", "problem-b", "problem-c", "problem-d"]

        async def _inner():
            with patch("backend.leetcode_fetcher.fetch_contest_metadata", new_callable=AsyncMock) as m_meta, \
                 patch("backend.leetcode_fetcher.fetch_contest_data", new_callable=AsyncMock) as m_cd, \
                 patch("backend.leetcode_fetcher.fetch_recent_submissions", new_callable=AsyncMock) as m_subs:
                m_meta.return_value = _make_contest_meta(slugs=slugs)
                m_cd.return_value = _make_contest_data_ok([])
                m_subs.return_value = _make_subs_ok([])
                return await fetch_verified_student_contest_record(_USER, _SLUG, "VIRTUAL")

        result = _run(_inner())
        self.assertEqual(result["participationStatus"], "NOT_PARTICIPATED")
        self.assertEqual(result["participationType"], "VIRTUAL")
        self.assertIsNone(result["solvedCount"])
        self.assertEqual(result["verificationLevel"], "DIRECT")
        self.assertAlmostEqual(result["confidence"], 0.90)

    # Case 8: Empty username → UNVERIFIED + error
    def test_case8_invalid_username_returns_unverified(self):
        result = _run(fetch_verified_student_contest_record("", _SLUG, "PUBLIC"))
        self.assertIsNotNone(result["error"])
        self.assertEqual(result["verificationLevel"], "UNVERIFIED")
        self.assertAlmostEqual(result["confidence"], 0.0)
        self.assertIsNone(result["solvedCount"])

    # Regression R2: totalProblems from metadata, never hardcoded
    def test_regression_r2_total_problems_from_metadata(self):
        async def _inner():
            with patch("backend.leetcode_fetcher.fetch_contest_metadata", new_callable=AsyncMock) as m_meta, \
                 patch("backend.leetcode_fetcher.fetch_contest_data", new_callable=AsyncMock) as m_cd, \
                 patch("backend.leetcode_fetcher.fetch_recent_submissions", new_callable=AsyncMock) as m_subs:
                m_meta.return_value = _make_contest_meta(total=5, slugs=["a", "b", "c", "d", "e"])
                m_cd.return_value = _make_contest_data_ok([
                    {"contest_name": "Weekly Contest 420", "attended": True,
                     "problems_solved": 5, "contest_rank": 100, "finish_time_seconds": 3000}
                ])
                m_subs.return_value = {"status": "error"}
                return await fetch_verified_student_contest_record(_USER, _SLUG, "PUBLIC")

        result = _run(_inner())
        self.assertEqual(result["totalProblems"], 5)

    # Regression R3: PUBLIC and VIRTUAL never merged
    def test_regression_r3_public_virtual_never_merged(self):
        slugs = ["problem-a", "problem-b", "problem-c", "problem-d"]

        async def _inner():
            with patch("backend.leetcode_fetcher.fetch_contest_metadata", new_callable=AsyncMock) as m_meta, \
                 patch("backend.leetcode_fetcher.fetch_contest_data", new_callable=AsyncMock) as m_cd, \
                 patch("backend.leetcode_fetcher.fetch_recent_submissions", new_callable=AsyncMock) as m_subs:
                m_meta.return_value = _make_contest_meta(slugs=slugs)
                m_cd.return_value = _make_contest_data_ok([
                    {"contest_name": "Weekly Contest 420", "attended": True,
                     "problems_solved": 3, "contest_rank": 5000, "finish_time_seconds": 4800}
                ])
                m_subs.return_value = {"status": "error"}
                pub = await fetch_verified_student_contest_record(_USER, _SLUG, "PUBLIC")
                virt = await fetch_verified_student_contest_record(_USER, _SLUG, "VIRTUAL")
            return pub, virt

        pub, virt = _run(_inner())
        self.assertEqual(pub["participationType"], "PUBLIC")
        self.assertEqual(virt["participationType"], "VIRTUAL")
        # PUBLIC participated, VIRTUAL had no subs → NOT_PARTICIPATED
        self.assertNotEqual(pub["participationStatus"], virt["participationStatus"])


if __name__ == "__main__":
    unittest.main()
