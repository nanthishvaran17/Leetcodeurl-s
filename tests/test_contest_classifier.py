import unittest
import datetime
from unittest.mock import AsyncMock, patch

from backend.services.contest_classifier import (
    ContestClassifier,
    ContestStatus,
    ReasonCode,
    FetchStatus,
    ContestStatusRow,
    normalize_contest_id,
    contest_number_from_id,
    get_contest_status,
)


class MockLeetCodeAPI:
    def __init__(self, scenarios: dict):
        self.scenarios = scenarios

    def validate_profile(self, username: str):
        key = (username, "any_contest")
        scenario = self.scenarios.get(key)
        if not scenario:
            return None
        if scenario.get("raise_error"):
            raise scenario["raise_error"]
        if not scenario.get("profile_valid", True):
            return None
        return {"username": username}

    def fetch_contest_result(self, username: str, contest_id: str):
        key = (username, contest_id)
        scenario = self.scenarios.get(key)
        if not scenario:
            return None
        if scenario.get("raise_error"):
            raise scenario["raise_error"]
        return scenario.get("contest_data")


class TestContestClassifierSync(unittest.TestCase):
    def test_pending_username(self):
        classifier = ContestClassifier(MockLeetCodeAPI({}))
        row = classifier.classify_student_contest(
            student_id=1,
            student_name="Test Student",
            leetcode_username=None,
            contest_id="weekly-contest-515",
            contest_name="Weekly Contest 515",
        )
        self.assertEqual(row.status, ContestStatus.PENDING_USERNAME)
        self.assertEqual(row.reason_code, ReasonCode.NO_USERNAME)

    def test_invalid_username(self):
        scenarios = {("invalid_user", "any_contest"): {"profile_valid": False}}
        classifier = ContestClassifier(MockLeetCodeAPI(scenarios))
        row = classifier.classify_student_contest(
            student_id=2,
            student_name="Test Student 2",
            leetcode_username="invalid_user",
            contest_id="weekly-contest-515",
            contest_name="Weekly Contest 515",
        )
        self.assertEqual(row.status, ContestStatus.INVALID_USERNAME)
        self.assertEqual(row.reason_code, ReasonCode.INVALID_PROFILE)

    def test_public_attended(self):
        scenarios = {
            ("public_user", "any_contest"): {"profile_valid": True},
            ("public_user", "weekly-contest-515"): {
                "contest_data": {
                    "username": "public_user",
                    "contest_id": "weekly-contest-515",
                    "attended": True,
                    "problems_solved": 3,
                    "score": 12,
                    "rank": 1500,
                    "rating_after": 1820.5,
                }
            },
        }
        classifier = ContestClassifier(MockLeetCodeAPI(scenarios))
        row = classifier.classify_student_contest(
            student_id=3,
            student_name="Public User",
            leetcode_username="public_user",
            contest_id="weekly-contest-515",
            contest_name="Weekly Contest 515",
        )
        self.assertEqual(row.status, ContestStatus.PUBLIC_ATTENDED)
        self.assertEqual(row.reason_code, ReasonCode.PUBLIC)
        self.assertEqual(row.problems_solved, 3)
        self.assertEqual(row.rating_after, 1820.5)

    def test_virtual_attended_refinement_a(self):
        scenarios = {
            ("virtual_user", "any_contest"): {"profile_valid": True},
            ("virtual_user", "weekly-contest-515"): {
                "contest_data": {
                    "username": "virtual_user",
                    "contest_id": "weekly-contest-515",
                    "attended": False,
                    "problems_solved": 2,
                    "score": 7,
                    "contest_slug": "weekly-contest-515",
                }
            },
        }
        classifier = ContestClassifier(MockLeetCodeAPI(scenarios))
        row = classifier.classify_student_contest(
            student_id=4,
            student_name="Virtual User",
            leetcode_username="virtual_user",
            contest_id="weekly-contest-515",
            contest_name="Weekly Contest 515",
        )
        self.assertEqual(row.status, ContestStatus.VIRTUAL_ATTENDED)
        self.assertEqual(row.reason_code, ReasonCode.VIRTUAL)

    def test_not_attended(self):
        scenarios = {
            ("absent_user", "any_contest"): {"profile_valid": True},
            ("absent_user", "weekly-contest-515"): None,
        }
        classifier = ContestClassifier(MockLeetCodeAPI(scenarios))
        row = classifier.classify_student_contest(
            student_id=5,
            student_name="Absent User",
            leetcode_username="absent_user",
            contest_id="weekly-contest-515",
            contest_name="Weekly Contest 515",
        )
        self.assertEqual(row.status, ContestStatus.NOT_ATTENDED)
        self.assertEqual(row.reason_code, ReasonCode.NO_PARTICIPATION)

    def test_fetch_failed(self):
        scenarios = {
            ("error_user", "any_contest"): {
                "profile_valid": True,
                "raise_error": TimeoutError("Network timeout"),
            },
        }
        classifier = ContestClassifier(MockLeetCodeAPI(scenarios))
        row = classifier.classify_student_contest(
            student_id=6,
            student_name="Error User",
            leetcode_username="error_user",
            contest_id="weekly-contest-515",
            contest_name="Weekly Contest 515",
        )
        self.assertEqual(row.status, ContestStatus.FETCH_FAILED)
        self.assertEqual(row.reason_code, ReasonCode.FETCH_ERROR)
        self.assertEqual(row.fetch_status, FetchStatus.FAILED)


class TestContestClassifierAsync(unittest.IsolatedAsyncioTestCase):
    def test_normalization(self):
        self.assertEqual(normalize_contest_id("Weekly Contest 515"), "weekly-contest-515")
        self.assertEqual(normalize_contest_id("Biweekly Contest 180"), "biweekly-contest-180")
        self.assertEqual(contest_number_from_id("weekly-contest-515"), 515)

    @patch("backend.services.contest_classifier._validate_leetcode_profile")
    @patch("backend.services.contest_classifier._fetch_contest_entry")
    async def test_async_public_attended(self, mock_fetch, mock_val):
        mock_client = AsyncMock()
        mock_val.return_value = ("ok", "nanthish_s")
        mock_fetch.return_value = ("ok", {
            "contest_title": "Weekly Contest 515",
            "contest_id": "weekly-contest-515",
            "attended": True,
            "problems_solved": 3,
            "ranking": 2239,
            "rating_after": 1785.4,
            "source_timestamp": datetime.datetime.now(datetime.timezone.utc),
        })

        row = await get_contest_status(
            student_id=10,
            student_name="Nanthish",
            leetcode_username="nanthish_s",
            contest_id="weekly-contest-515",
            contest_name="Weekly Contest 515",
            client=mock_client,
        )
        self.assertEqual(row.status, ContestStatus.PUBLIC_ATTENDED)
        self.assertEqual(row.problems_solved, 3)
        self.assertEqual(row.rank, 2239)


if __name__ == "__main__":
    unittest.main()
