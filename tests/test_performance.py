import unittest
import time
from backend.services.contest_classifier import ContestClassifier
from tests.test_reconciliation import MockLeetCodeAPIReconciliation, generate_mock_roster


class TestPerformance(unittest.TestCase):

    def test_batch_performance(self):
        """
        Ensure: 300 students classified in < 5.0 seconds.
        """
        students = generate_mock_roster(300)
        mock_api = MockLeetCodeAPIReconciliation()
        classifier = ContestClassifier(mock_api)

        start = time.time()
        results = classifier.classify_batch(students, "weekly-contest-515", "Weekly Contest 515")
        elapsed = time.time() - start

        self.assertEqual(len(results), 300)
        self.assertLess(elapsed, 5.0, f"Performance degradation: {elapsed:.2f}s > 5s")

        print(f"\n[PASS] Performance OK: 300 students in {elapsed:.4f}s")


if __name__ == "__main__":
    unittest.main()
