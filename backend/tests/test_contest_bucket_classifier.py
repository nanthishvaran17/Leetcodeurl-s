"""
Unit tests for contest_bucket_classifier.py
Covers: 4/4, 3/4, 2/4, 1/4, verified 0/4, NOT_PARTICIPATED, UNKNOWN, SOURCE_UNAVAILABLE,
and separation of Public vs Virtual.
"""
import unittest

from backend.services.contest_bucket_classifier import (
    classify_public_contest_outcome,
    classify_virtual_contest_outcome
)


class TestContestBucketClassifier(unittest.TestCase):

    def test_case5_to_8_solved_counts_public(self):
        """Tests 4/4, 3/4, 2/4, 1/4 public classifications."""
        r4 = {"participation_status": "PUBLIC_ATTENDED", "total_contest_solved": 4}
        r3 = {"participation_status": "PUBLIC_ATTENDED", "total_contest_solved": 3}
        r2 = {"participation_status": "PUBLIC", "total_contest_solved": 2}
        r1 = {"participation_status": "PUBLIC", "total_contest_solved": 1}

        self.assertEqual(classify_public_contest_outcome(r4), "4_SOLVED")
        self.assertEqual(classify_public_contest_outcome(r3), "3_SOLVED")
        self.assertEqual(classify_public_contest_outcome(r2), "2_SOLVED")
        self.assertEqual(classify_public_contest_outcome(r1), "1_SOLVED")

    def test_case9_verified_0_solved(self):
        """Verified participation with 0 questions solved gives 0_SOLVED."""
        r0 = {"participation_status": "PUBLIC_ATTENDED", "total_contest_solved": 0, "confidence": "VERIFIED"}
        self.assertEqual(classify_public_contest_outcome(r0), "0_SOLVED")

        r0_vir = {"participation_status": "VIRTUAL_ATTENDED", "total_contest_solved": 0}
        self.assertEqual(classify_virtual_contest_outcome(r0_vir), "0_SOLVED")

    def test_case10_not_participated(self):
        """Not attended records classify strictly as NOT_PARTICIPATED."""
        r_not = {"participation_status": "PUBLIC_NOT_ATTENDED", "total_contest_solved": 0}
        self.assertEqual(classify_public_contest_outcome(r_not), "NOT_PARTICIPATED")

        r_abs = {"participation_status": "NOT_ATTENDED", "total_contest_solved": None}
        self.assertEqual(classify_public_contest_outcome(r_abs), "NOT_PARTICIPATED")

        r_vir_not = {"participation_status": "VIRTUAL_NOT_ATTENDED"}
        self.assertEqual(classify_virtual_contest_outcome(r_vir_not), "NOT_PARTICIPATED")

    def test_case11_unknown_status(self):
        """Unknown or missing username status classifies as UNKNOWN."""
        r_un = {"participation_status": "UNKNOWN", "data_fetch_status": "DATA_UNAVAILABLE", "total_contest_solved": None}
        self.assertEqual(classify_public_contest_outcome(r_un), "UNKNOWN")

        r_inv = {"participation_status": "PENDING", "data_fetch_status": "INVALID_USERNAME", "total_contest_solved": None}
        self.assertEqual(classify_public_contest_outcome(r_inv), "UNKNOWN")

        # None input gives UNKNOWN for public
        self.assertEqual(classify_public_contest_outcome(None), "UNKNOWN")

    def test_case12_source_unavailable(self):
        """Fetch error or timeout classifies strictly as SOURCE_UNAVAILABLE."""
        r_err = {"participation_status": "DATA_ERROR", "data_fetch_status": "FETCH_FAILED", "total_contest_solved": None}
        self.assertEqual(classify_public_contest_outcome(r_err), "SOURCE_UNAVAILABLE")

        r_to = {"error_type": "TIMEOUT", "data_fetch_status": "TIMEOUT", "total_contest_solved": None}
        self.assertEqual(classify_public_contest_outcome(r_to), "SOURCE_UNAVAILABLE")

    def test_case13_public_and_virtual_separate(self):
        """Public 3/4 and Virtual 4/4 for the same student remain completely distinct."""
        pub_record = {"participation_status": "PUBLIC_ATTENDED", "total_contest_solved": 3}
        vir_record = {"participation_status": "VIRTUAL_ATTENDED", "total_contest_solved": 4}

        pub_outcome = classify_public_contest_outcome(pub_record)
        vir_outcome = classify_virtual_contest_outcome(vir_record)

        self.assertEqual(pub_outcome, "3_SOLVED")
        self.assertEqual(vir_outcome, "4_SOLVED")
        self.assertNotEqual(pub_outcome, vir_outcome)

    def test_case14_none_never_becomes_zero(self):
        """None total_contest_solved must never be silently converted to 0_SOLVED."""
        r_none = {"participation_status": "UNKNOWN", "total_contest_solved": None}
        self.assertNotEqual(classify_public_contest_outcome(r_none), "0_SOLVED")
        self.assertEqual(classify_public_contest_outcome(r_none), "UNKNOWN")


if __name__ == "__main__":
    unittest.main()
