import unittest
from backend.services.contest_reconciliation_service import (
    Contest516ReconciliationService, match_contest_problem, CONTEST_516_PROBLEMS
)
from backend.database import SessionLocal
from backend.models import Student, Department


class MockStudent:
    def __init__(self, id, reg_no, name, username, dept_code="CSE", year="III"):
        self.id = id
        self.reg_no = reg_no
        self.name = name
        self.username = username
        self.department = Department(code=dept_code, name="Computer Science")
        self.year_level = year


class TestVirtualContest516Detection(unittest.TestCase):

    def test_problem_set_mapping(self):
        """Test authoritative Weekly Contest 516 problem slug & title resolution"""
        self.assertEqual(len(CONTEST_516_PROBLEMS), 4)
        
        # Test exact & fuzzy slug matching
        p1 = match_contest_problem("check-ascii-palindromic")
        self.assertIsNotNone(p1)
        self.assertEqual(p1["id"], "Q1")

        p2 = match_contest_problem("Find All Numbers Disappeared in an Array II")
        self.assertIsNotNone(p2)
        self.assertEqual(p2["id"], "Q2")

        p3 = match_contest_problem("longest-subarray-with-at-most-k-distinct-prime-factors")
        self.assertIsNotNone(p3)
        self.assertEqual(p3["id"], "Q3")

        p4 = match_contest_problem("sum-game")
        self.assertIsNotNone(p4)
        self.assertEqual(p4["id"], "Q4")

        # Unrelated problem should NOT match
        self.assertIsNone(match_contest_problem("two-sum"))
        self.assertIsNone(match_contest_problem("reverse-linked-list"))

    def test_a_live_participant(self):
        """Test A: Live participant -> LIVE_ATTENDED"""
        student = MockStudent(1, "732224CS001", "Student Live", "student_live")
        ranking_history = {"attended": True, "problemsSolved": 2, "ranking": 1240, "rating": 1560}
        recent_subs = []

        res = Contest516ReconciliationService.classify_student_submissions(student, ranking_history, recent_subs)
        self.assertEqual(res["attendance_status"], "LIVE_ATTENDED")
        self.assertTrue(res["is_live"])
        self.assertFalse(res["is_virtual"])
        self.assertEqual(res["total_solved"], 2)

    def test_b_verified_virtual_participant(self):
        """Test B: Verified virtual participant -> VIRTUAL_ATTENDED"""
        student = MockStudent(2, "732224CS002", "Student Virtual", "student_virt")
        ranking_history = None  # Did not attend live
        recent_subs = [
            # Solved Q1 & Q2 post-contest (e.g. at 11:30 AM IST = 1787464200)
            {"title": "Check ASCII Palindromic", "titleSlug": "check-ascii-palindromic", "timestamp": 1787464200},
            {"title": "Find All Numbers Disappeared in an Array II", "titleSlug": "find-all-numbers-disappeared-in-an-array-ii", "timestamp": 1787465000}
        ]

        res = Contest516ReconciliationService.classify_student_submissions(student, ranking_history, recent_subs)
        self.assertEqual(res["attendance_status"], "VIRTUAL_ATTENDED")
        self.assertFalse(res["is_live"])
        self.assertTrue(res["is_virtual"])
        self.assertEqual(res["total_solved"], 2)
        self.assertEqual(res["q1"], 1)
        self.assertEqual(res["q2"], 1)
        self.assertEqual(res["q3"], 0)

    def test_c_no_evidence_not_attended(self):
        """Test C: Valid profile with 0 contest activity -> NOT_ATTENDED"""
        student = MockStudent(3, "732224CS003", "Student Absent", "student_absent")
        ranking_history = None
        recent_subs = []

        res = Contest516ReconciliationService.classify_student_submissions(student, ranking_history, recent_subs)
        self.assertEqual(res["attendance_status"], "NOT_ATTENDED")
        self.assertFalse(res["is_live"])
        self.assertFalse(res["is_virtual"])
        self.assertEqual(res["total_solved"], 0)

    def test_d_invalid_profile_data_error(self):
        """Test D: Invalid / missing LeetCode profile -> DATA_ERROR"""
        student = MockStudent(4, "732224CS004", "Student Broken", "")
        res = Contest516ReconciliationService.classify_student_submissions(student, None, [])
        self.assertEqual(res["attendance_status"], "DATA_ERROR")
        self.assertFalse(res["is_live"])
        self.assertFalse(res["is_virtual"])

    def test_e_live_plus_virtual_priority(self):
        """Test E: Live + later virtual -> counted strictly once as LIVE_ATTENDED"""
        student = MockStudent(5, "732224CS005", "Student Both", "student_both")
        ranking_history = {"attended": True, "problemsSolved": 1, "ranking": 3500}
        recent_subs = [
            # Later solved Q2 & Q3 virtually
            {"title": "Find All Numbers Disappeared in an Array II", "titleSlug": "find-all-numbers-disappeared-in-an-array-ii", "timestamp": 1787465000}
        ]

        res = Contest516ReconciliationService.classify_student_submissions(student, ranking_history, recent_subs)
        # Priority must be LIVE_ATTENDED
        self.assertEqual(res["attendance_status"], "LIVE_ATTENDED")
        self.assertTrue(res["is_live"])
        self.assertFalse(res["is_virtual"])  # Not double counted as virtual

    def test_f_ordinary_unrelated_submission_not_virtual(self):
        """Test F: Ordinary submission to unrelated problem -> NOT virtual"""
        student = MockStudent(6, "732224CS006", "Student Daily", "student_daily")
        ranking_history = None
        recent_subs = [
            {"title": "Two Sum", "titleSlug": "two-sum", "timestamp": 1787464200},
            {"title": "Valid Anagram", "titleSlug": "valid-anagram", "timestamp": 1787465000}
        ]

        res = Contest516ReconciliationService.classify_student_submissions(student, ranking_history, recent_subs)
        self.assertEqual(res["attendance_status"], "NOT_ATTENDED")
        self.assertFalse(res["is_virtual"])

    def test_i_and_j_full_1450_roster_reconciliation(self):
        """Test I & J: Reconcile complete 1,450 student database with strict mutual exclusivity"""
        db = SessionLocal()
        try:
            res = Contest516ReconciliationService.reconcile_session_21(db)
            audit = res["audit"]
            self.assertEqual(audit["total_roster"], 1450)
            self.assertTrue(audit["reconciliation_passed"])

            live = audit["live_attended"]
            virt = audit["virtual_attended"]
            not_att = audit["not_attended"]
            errs = audit["data_errors"]

            # Mathematical Invariant
            self.assertEqual(live + virt + not_att + errs, 1450)

            # Check mutual exclusivity
            records = res["records"]
            for r in records:
                statuses = [r["is_live"], r["is_virtual"], r["attendance_status"] == "NOT_ATTENDED", r["attendance_status"] == "DATA_ERROR"]
                # Must match exactly one category
                self.assertEqual(sum(1 for s in statuses if s is True), 1, f"Student {r['reg_no']} violated mutual exclusivity: {r}")
        finally:
            db.close()


if __name__ == "__main__":
    unittest.main()
