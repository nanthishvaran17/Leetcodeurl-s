import unittest
from backend.services.contest_classifier import (
    ContestClassifier,
    ContestStatus,
    ReasonCode,
)


class MockLeetCodeAPIEdgeCases:
    def __init__(self, scenarios: dict):
        self.scenarios = scenarios

    def validate_profile(self, username: str):
        key = (username, "any_contest")
        scenario = self.scenarios.get(key, {})
        if scenario.get("profile_valid", True):
            return {"username": username}
        return None

    def fetch_contest_result(self, username: str, contest_id: str):
        key = (username, contest_id)
        scenario = self.scenarios.get(key, {})
        return scenario.get("contest_data")


class TestEdgeCases(unittest.TestCase):

    def test_virtual_with_zero_solves(self):
        """
        Virtual participation but 0 problems solved -> should be VIRTUAL_ATTENDED
        if contest entry exists in history.
        """
        scenarios = {
            ("virtual_zero", "any_contest"): {"profile_valid": True},
            ("virtual_zero", "weekly-contest-515"): {
                "contest_data": {
                    "username": "virtual_zero",
                    "contest_id": "weekly-contest-515",
                    "attended": False,
                    "problems_solved": 0,
                    "contest_slug": "weekly-contest-515",  # Entry exists
                }
            },
        }
        api = MockLeetCodeAPIEdgeCases(scenarios)
        classifier = ContestClassifier(api)

        row = classifier.classify_student_contest(
            student_id=99,
            student_name="Virtual Zero",
            leetcode_username="virtual_zero",
            contest_id="weekly-contest-515",
            contest_name="Weekly Contest 515",
        )

        self.assertEqual(row.status, ContestStatus.VIRTUAL_ATTENDED)
        self.assertEqual(row.problems_solved, 0)
        self.assertEqual(row.reason_code, ReasonCode.VIRTUAL)

    def test_identity_mismatch(self):
        """
        API returns different username -> UNKNOWN with IDENTITY_MISMATCH reason code.
        """
        scenarios = {
            ("mismatch_user", "any_contest"): {"profile_valid": True},
            ("mismatch_user", "weekly-contest-515"): {
                "contest_data": {
                    "username": "wrong_user",  # Mismatch!
                    "contest_id": "weekly-contest-515",
                    "attended": True,
                }
            },
        }
        api = MockLeetCodeAPIEdgeCases(scenarios)
        classifier = ContestClassifier(api)

        row = classifier.classify_student_contest(
            student_id=100,
            student_name="Mismatch User",
            leetcode_username="mismatch_user",
            contest_id="weekly-contest-515",
            contest_name="Weekly Contest 515",
        )

        self.assertEqual(row.status, ContestStatus.UNKNOWN)
        self.assertEqual(row.reason_code, ReasonCode.IDENTITY_MISMATCH)


if __name__ == "__main__":
    unittest.main()
