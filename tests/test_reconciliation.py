import unittest
from typing import List, Dict, Any
from backend.services.contest_classifier import (
    ContestClassifier,
    ContestStatus,
)


class MockLeetCodeAPIReconciliation:
    """Mock API simulating realistic distribution for 300 students."""

    def validate_profile(self, username: str):
        if not username or username == "invalid_user":
            return None
        return {"username": username}

    def fetch_contest_result(self, username: str, contest_id: str):
        if "error" in username:
            raise TimeoutError("Simulated API timeout")
        if "public" in username:
            return {
                "username": username,
                "contest_id": contest_id,
                "attended": True,
                "problems_solved": 3,
                "score": 12,
                "rank": 1200,
            }
        if "virtual" in username:
            return {
                "username": username,
                "contest_id": contest_id,
                "attended": False,
                "problems_solved": 2,
                "contest_slug": contest_id,
            }
        if "mismatch" in username:
            return {
                "username": "different_handle",
                "contest_id": contest_id,
                "attended": True,
            }
        # Absent students return None (not in history)
        return None


def generate_mock_roster(count: int = 300) -> List[Dict[str, Any]]:
    roster = []
    for i in range(1, count + 1):
        if i <= 45:
            uname = f"public_user_{i}"
        elif i <= 77:
            uname = f"virtual_user_{i}"
        elif i <= 275:
            uname = f"absent_user_{i}"
        elif i <= 287:
            uname = f"error_user_{i}"
        elif i <= 295:
            uname = None  # Pending username
        elif i <= 298:
            uname = "invalid_user"  # Invalid profile
        else:
            uname = f"mismatch_user_{i}"  # Identity mismatch

        roster.append({
            "student_id": i,
            "student_name": f"Student {i}",
            "leetcode_username": uname,
        })
    return roster


class TestReconciliation(unittest.TestCase):

    def test_full_roster_reconciliation(self):
        """
        Ensure: Total roster students = sum of all status rows
        """
        students = generate_mock_roster(300)
        contest_id = "weekly-contest-515"

        mock_api = MockLeetCodeAPIReconciliation()
        classifier = ContestClassifier(mock_api)
        results = classifier.classify_batch(students, contest_id, "Weekly Contest 515")

        # Invariant check: exactly 300 rows produced
        self.assertEqual(len(results), 300, "Reconciliation failed: row count mismatch")

        # Status distribution sanity check
        status_counts = {}
        for row in results:
            status_counts[row.status.value] = status_counts.get(row.status.value, 0) + 1

        total = sum(status_counts.values())
        self.assertEqual(total, 300, f"Status sum mismatch: {total} != 300")

        # Verify exact counts match roster generation partitions
        self.assertEqual(status_counts.get(ContestStatus.PUBLIC_ATTENDED.value, 0), 45)
        self.assertEqual(status_counts.get(ContestStatus.VIRTUAL_ATTENDED.value, 0), 32)
        self.assertEqual(status_counts.get(ContestStatus.NOT_ATTENDED.value, 0), 198)
        self.assertEqual(status_counts.get(ContestStatus.FETCH_FAILED.value, 0), 12)
        self.assertEqual(status_counts.get(ContestStatus.PENDING_USERNAME.value, 0), 8)
        self.assertEqual(status_counts.get(ContestStatus.INVALID_USERNAME.value, 0), 3)
        self.assertEqual(status_counts.get(ContestStatus.UNKNOWN.value, 0), 2)

        print(f"\n[PASS] Reconciliation passed: {status_counts}")


if __name__ == "__main__":
    unittest.main()
