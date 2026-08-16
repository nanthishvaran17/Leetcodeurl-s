import unittest
import asyncio
from unittest.mock import AsyncMock, patch, MagicMock
import datetime

from backend.services.contest_classifier import (
    ContestStatus,
    ReasonCode,
    FetchStatus,
    ContestStatusRow,
    normalize_contest_id,
    contest_number_from_id,
    get_contest_status,
    classify_all_students,
    ContestSyncResult,
)

class TestContestClassifierDecisionAlgorithm(unittest.IsolatedAsyncioTestCase):

    def test_contest_id_normalization(self):
        self.assertEqual(normalize_contest_id("Weekly Contest 515"), "weekly-contest-515")
        self.assertEqual(normalize_contest_id("weekly-contest-515"), "weekly-contest-515")
        self.assertEqual(normalize_contest_id("WEEKLY CONTEST 514"), "weekly-contest-514")
        self.assertEqual(normalize_contest_id("Biweekly Contest 165"), "biweekly-contest-165")
        self.assertEqual(contest_number_from_id("weekly-contest-515"), 515)
        self.assertEqual(contest_number_from_id("biweekly-contest-165"), 165)

    async def test_step_1_1_missing_username(self):
        mock_client = AsyncMock()
        
        # Test None username
        row_none = await get_contest_status(
            student_id=1,
            student_name="Test Student",
            leetcode_username=None,
            contest_id="weekly-contest-515",
            contest_name="Weekly Contest 515",
            client=mock_client
        )
        self.assertEqual(row_none.status, ContestStatus.PENDING_USERNAME)
        self.assertEqual(row_none.reason_code, ReasonCode.NO_USERNAME)
        self.assertEqual(row_none.fetch_status, FetchStatus.FAILED)

        # Test Empty string username
        row_empty = await get_contest_status(
            student_id=2,
            student_name="Test Student 2",
            leetcode_username="   ",
            contest_id="weekly-contest-515",
            contest_name="Weekly Contest 515",
            client=mock_client
        )
        self.assertEqual(row_empty.status, ContestStatus.PENDING_USERNAME)
        self.assertEqual(row_empty.reason_code, ReasonCode.NO_USERNAME)

    @patch("backend.services.contest_classifier._validate_leetcode_profile")
    async def test_step_1_2_invalid_username_or_profile_not_found(self, mock_val):
        mock_client = AsyncMock()
        mock_val.return_value = ("not_found", None)

        row = await get_contest_status(
            student_id=3,
            student_name="Nonexistent User",
            leetcode_username="ghost_user_9999",
            contest_id="weekly-contest-515",
            contest_name="Weekly Contest 515",
            client=mock_client
        )
        self.assertEqual(row.status, ContestStatus.INVALID_USERNAME)
        self.assertEqual(row.reason_code, ReasonCode.INVALID_PROFILE)

    @patch("backend.services.contest_classifier._validate_leetcode_profile")
    async def test_step_1_2_profile_fetch_error_is_fetch_failed(self, mock_val):
        mock_client = AsyncMock()
        mock_val.return_value = ("timeout", None)

        row = await get_contest_status(
            student_id=4,
            student_name="Timeout User",
            leetcode_username="valid_user",
            contest_id="weekly-contest-515",
            contest_name="Weekly Contest 515",
            client=mock_client
        )
        self.assertEqual(row.status, ContestStatus.FETCH_FAILED)
        self.assertEqual(row.reason_code, ReasonCode.FETCH_ERROR)

    @patch("backend.services.contest_classifier._validate_leetcode_profile")
    @patch("backend.services.contest_classifier._fetch_contest_entry")
    async def test_step_2_contest_fetch_failed(self, mock_fetch, mock_val):
        mock_client = AsyncMock()
        mock_val.return_value = ("ok", "valid_user")
        mock_fetch.return_value = ("timeout", None)

        row = await get_contest_status(
            student_id=5,
            student_name="Fetch Fail User",
            leetcode_username="valid_user",
            contest_id="weekly-contest-515",
            contest_name="Weekly Contest 515",
            client=mock_client
        )
        # CRITICAL RULE: Network error must NEVER be treated as NOT_ATTENDED
        self.assertEqual(row.status, ContestStatus.FETCH_FAILED)
        self.assertEqual(row.reason_code, ReasonCode.FETCH_ERROR)

    @patch("backend.services.contest_classifier._validate_leetcode_profile")
    @patch("backend.services.contest_classifier._fetch_contest_entry")
    async def test_step_4_not_attended_verified(self, mock_fetch, mock_val):
        mock_client = AsyncMock()
        mock_val.return_value = ("ok", "valid_user")
        
        # Scenario A: Contest not in history (definitive absence)
        mock_fetch.return_value = ("not_in_history", None)
        row_a = await get_contest_status(
            student_id=6,
            student_name="No Contest User",
            leetcode_username="valid_user",
            contest_id="weekly-contest-515",
            contest_name="Weekly Contest 515",
            client=mock_client
        )
        self.assertEqual(row_a.status, ContestStatus.NOT_ATTENDED)
        self.assertEqual(row_a.reason_code, ReasonCode.NO_PARTICIPATION)

        # Scenario B: Contest in history with attended=False and 0 solved
        mock_fetch.return_value = ("ok", {
            "contest_title": "Weekly Contest 515",
            "contest_id": "weekly-contest-515",
            "attended": False,
            "problems_solved": 0,
            "total_problems": 4,
            "ranking": None,
            "rating_after": None,
            "finish_time_seconds": None,
            "start_timestamp": 1755000000,
            "source_timestamp": datetime.datetime.now(datetime.timezone.utc)
        })
        row_b = await get_contest_status(
            student_id=7,
            student_name="Absent User",
            leetcode_username="valid_user",
            contest_id="weekly-contest-515",
            contest_name="Weekly Contest 515",
            client=mock_client
        )
        self.assertEqual(row_b.status, ContestStatus.NOT_ATTENDED)
        self.assertEqual(row_b.reason_code, ReasonCode.NO_PARTICIPATION)

    @patch("backend.services.contest_classifier._validate_leetcode_profile")
    @patch("backend.services.contest_classifier._fetch_contest_entry")
    async def test_step_5_public_attended(self, mock_fetch, mock_val):
        mock_client = AsyncMock()
        mock_val.return_value = ("ok", "leet_coder")
        mock_fetch.return_value = ("ok", {
            "contest_title": "Weekly Contest 515",
            "contest_id": "weekly-contest-515",
            "attended": True,
            "problems_solved": 3,
            "total_problems": 4,
            "ranking": 1250,
            "rating_after": 1785.4,
            "finish_time_seconds": 3200,
            "start_timestamp": 1755000000,
            "source_timestamp": datetime.datetime.now(datetime.timezone.utc)
        })

        row = await get_contest_status(
            student_id=8,
            student_name="Competitive Programmer",
            leetcode_username="leet_coder",
            contest_id="weekly-contest-515",
            contest_name="Weekly Contest 515",
            client=mock_client
        )
        self.assertEqual(row.status, ContestStatus.PUBLIC_ATTENDED)
        self.assertEqual(row.reason_code, ReasonCode.PUBLIC)
        self.assertEqual(row.problems_solved, 3)
        self.assertEqual(row.score, 3)
        self.assertEqual(row.rank, 1250)
        self.assertEqual(row.rating_after, 1785.4)
        self.assertTrue(row.q1_solved)
        self.assertTrue(row.q2_solved)
        self.assertTrue(row.q3_solved)
        self.assertFalse(row.q4_solved)

    @patch("backend.services.contest_classifier._validate_leetcode_profile")
    @patch("backend.services.contest_classifier._fetch_contest_entry")
    async def test_step_5_virtual_attended(self, mock_fetch, mock_val):
        mock_client = AsyncMock()
        mock_val.return_value = ("ok", "virtual_coder")
        mock_fetch.return_value = ("ok", {
            "contest_title": "Weekly Contest 515",
            "contest_id": "weekly-contest-515",
            "attended": False,
            "problems_solved": 2,
            "total_problems": 4,
            "ranking": None,
            "rating_after": None,
            "finish_time_seconds": 4500,
            "start_timestamp": 1755000000,
            "source_timestamp": datetime.datetime.now(datetime.timezone.utc)
        })

        row = await get_contest_status(
            student_id=9,
            student_name="Virtual User",
            leetcode_username="virtual_coder",
            contest_id="weekly-contest-515",
            contest_name="Weekly Contest 515",
            client=mock_client
        )
        self.assertEqual(row.status, ContestStatus.VIRTUAL_ATTENDED)
        self.assertEqual(row.reason_code, ReasonCode.VIRTUAL)
        self.assertEqual(row.problems_solved, 2)
        self.assertTrue(row.q1_solved)
        self.assertTrue(row.q2_solved)
        self.assertFalse(row.q3_solved)
        self.assertFalse(row.q4_solved)

    def test_reconciliation_math(self):
        result = ContestSyncResult(
            contest_id="weekly-contest-515",
            contest_name="Weekly Contest 515",
            total_roster=5,
            public_attended=1,
            virtual_attended=1,
            not_attended=1,
            fetch_failed=1,
            pending_username=1,
            invalid_username=0,
            unknown=0
        )
        result.validate_reconciliation()
        self.assertTrue(result.reconciliation_ok)
        self.assertIsNone(result.reconciliation_error)

        # Force a mismatch
        result.total_roster = 6
        result.validate_reconciliation()
        self.assertFalse(result.reconciliation_ok)
        self.assertIn("RECONCILIATION FAILED", result.reconciliation_error)

if __name__ == "__main__":
    unittest.main()
