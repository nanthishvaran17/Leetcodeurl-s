"""
COMPREHENSIVE AUTOMATED TEST SUITE: UNIVERSAL CONTEST RECONCILIATION ENGINE
=============================================================================
Verifies 15 Enterprise Scenarios across dynamic contests, forensic evidence levels,
priority rules, mathematical invariants, and roster reconciliations.
"""

import unittest

from backend.services.contest_reconciliation_service import (
    ContestMetadataResolver, match_contest_problem,
    UniversalContestReconciliationEngine, ContestReconciliationService,
    EvidenceLevel
)


class MockStudent:
    def __init__(self, id, reg_no, name, username, dept_code="CSE", year="III"):
        self.id = id
        self.reg_no = reg_no
        self.name = name
        self.username = username
        self.year_level = year
        self.department = type('MockDept', (), {'code': dept_code})()
        self.is_active = True


class TestUniversalContestReconciliationEngine(unittest.TestCase):

    def setUp(self):
        self.meta_516 = ContestMetadataResolver.resolve_contest_metadata(516)
        self.meta_517 = ContestMetadataResolver.resolve_contest_metadata(517)

    # ─── TEST 1: Valid Live Participant -> LIVE_ATTENDED ───────────────────────
    def test_01_valid_live_participant(self):
        student = MockStudent(1, "732224CS001", "Live Student", "live_coder")
        ranking_history = {"attended": True, "problemsSolved": 2, "ranking": 3500, "rating": 1650.0}
        recent_subs = []

        res = UniversalContestReconciliationEngine.classify_student(student, ranking_history, recent_subs, self.meta_516)
        self.assertEqual(res["attendance_status"], "LIVE_ATTENDED")
        self.assertTrue(res["is_live"])
        self.assertFalse(res["is_virtual"])
        self.assertEqual(res["total_solved"], 2)
        self.assertEqual(res["evidence_level"], EvidenceLevel.EXPLICIT_CONTEST)

    # ─── TEST 2: Verified Virtual Participant -> VIRTUAL_ATTENDED ─────────────
    def test_02_verified_virtual_participant(self):
        student = MockStudent(2, "732224CS002", "Virtual Student", "virt_coder")
        ranking_history = None
        recent_subs = [
            {"title": "Check ASCII Palindromic", "titleSlug": "check-ascii-palindromic", "timestamp": self.meta_516["end_timestamp_utc"] + 3600, "statusDisplay": "Accepted"},
            {"title": "Find All Numbers Disappeared in an Array II", "titleSlug": "find-all-numbers-disappeared-in-an-array-ii", "timestamp": self.meta_516["end_timestamp_utc"] + 7200, "statusDisplay": "Accepted"}
        ]

        res = UniversalContestReconciliationEngine.classify_student(student, ranking_history, recent_subs, self.meta_516)
        self.assertEqual(res["attendance_status"], "VIRTUAL_ATTENDED")
        self.assertFalse(res["is_live"])
        self.assertTrue(res["is_virtual"])
        self.assertEqual(res["total_solved"], 2)
        self.assertEqual(res["q1"], 1)
        self.assertEqual(res["q2"], 1)
        self.assertEqual(res["q3"], 0)
        self.assertEqual(res["evidence_level"], EvidenceLevel.VERIFIED_CONTEST)

    # ─── TEST 3: Valid Profile, No Participation -> NOT_ATTENDED ──────────────
    def test_03_valid_profile_no_participation(self):
        student = MockStudent(3, "732224CS003", "Absent Student", "absent_coder")
        ranking_history = None
        recent_subs = []

        res = UniversalContestReconciliationEngine.classify_student(student, ranking_history, recent_subs, self.meta_516)
        self.assertEqual(res["attendance_status"], "NOT_ATTENDED")
        self.assertFalse(res["is_live"])
        self.assertFalse(res["is_virtual"])
        self.assertEqual(res["total_solved"], 0)
        self.assertEqual(res["evidence_level"], EvidenceLevel.NO_EVIDENCE)

    # ─── TEST 4: Invalid Profile -> DATA_ERROR ────────────────────────────────
    def test_04_invalid_profile_data_error(self):
        student1 = MockStudent(4, "732224CS004", "Missing Handle", "")
        student2 = MockStudent(5, "732224CS005", "Unlinked Handle", "UNLINKED")
        student3 = MockStudent(6, "732224CS006", "Null Handle", None)

        res1 = UniversalContestReconciliationEngine.classify_student(student1, None, [], self.meta_516)
        res2 = UniversalContestReconciliationEngine.classify_student(student2, None, [], self.meta_516)
        res3 = UniversalContestReconciliationEngine.classify_student(student3, None, [], self.meta_516)

        self.assertEqual(res1["attendance_status"], "DATA_ERROR")
        self.assertEqual(res2["attendance_status"], "DATA_ERROR")
        self.assertEqual(res3["attendance_status"], "DATA_ERROR")
        self.assertEqual(res1["evidence_level"], EvidenceLevel.PROFILE_ERROR)

    # ─── TEST 5: Live + Virtual Practice -> LIVE_ATTENDED (Priority Rule) ─────
    def test_05_live_priority_over_virtual(self):
        student = MockStudent(7, "732224CS007", "Dual Student", "dual_coder")
        ranking_history = {"attended": True, "problemsSolved": 1, "ranking": 8200}
        recent_subs = [
            {"title": "Check ASCII Palindromic", "titleSlug": "check-ascii-palindromic", "timestamp": self.meta_516["end_timestamp_utc"] + 3600, "statusDisplay": "Accepted"},
            {"title": "Sum Game", "titleSlug": "sum-game", "timestamp": self.meta_516["end_timestamp_utc"] + 7200, "statusDisplay": "Accepted"}
        ]

        res = UniversalContestReconciliationEngine.classify_student(student, ranking_history, recent_subs, self.meta_516)
        self.assertEqual(res["attendance_status"], "LIVE_ATTENDED")
        self.assertTrue(res["is_live"])
        self.assertFalse(res["is_virtual"])
        self.assertEqual(res["evidence_level"], EvidenceLevel.EXPLICIT_CONTEST)

    # ─── TEST 6: Ordinary Daily Problem Submission -> NOT_ATTENDED / UNVERIFIED
    def test_06_ordinary_daily_problem_rejection(self):
        student = MockStudent(8, "732224CS008", "Daily Coder", "daily_coder")
        ranking_history = None
        recent_subs = [
            {"title": "Two Sum", "titleSlug": "two-sum", "timestamp": self.meta_516["end_timestamp_utc"] + 3600, "statusDisplay": "Accepted"},
            {"title": "Valid Anagram", "titleSlug": "valid-anagram", "timestamp": self.meta_516["end_timestamp_utc"] + 7200, "statusDisplay": "Accepted"},
            {"title": "Reverse Linked List", "titleSlug": "reverse-linked-list", "timestamp": self.meta_516["end_timestamp_utc"] + 10800, "statusDisplay": "Accepted"}
        ]

        res = UniversalContestReconciliationEngine.classify_student(student, ranking_history, recent_subs, self.meta_516)
        self.assertEqual(res["attendance_status"], "NOT_ATTENDED")
        self.assertFalse(res["is_virtual"])
        self.assertEqual(res["total_solved"], 0)
        self.assertIsNone(match_contest_problem("two-sum", self.meta_516["problems"]))
        self.assertIsNone(match_contest_problem("valid-anagram", self.meta_516["problems"]))

    # ─── TEST 7: Contest-Specific Virtual Evidence -> VIRTUAL_ATTENDED ────────
    def test_07_contest_specific_virtual_evidence(self):
        student = MockStudent(9, "732224CS009", "Specific Virtual", "specific_virt")
        ranking_history = None
        recent_subs = [
            {"title": "Longest Subarray With at Most K Distinct Prime Factors", "titleSlug": "longest-subarray-with-at-most-k-distinct-prime-factors", "timestamp": self.meta_516["end_timestamp_utc"] + 5000, "statusDisplay": "Accepted"}
        ]

        res = UniversalContestReconciliationEngine.classify_student(student, ranking_history, recent_subs, self.meta_516)
        self.assertEqual(res["attendance_status"], "VIRTUAL_ATTENDED")
        self.assertTrue(res["is_virtual"])
        self.assertEqual(res["q3"], 1)
        self.assertEqual(res["total_solved"], 1)

    # ─── TEST 8: Duplicate Sync Idempotency ───────────────────────────────────
    def test_08_duplicate_sync_idempotency(self):
        from backend.database import SessionLocal
        db = SessionLocal()
        try:
            res1 = ContestReconciliationService.reconcile_contest(21, db, sync_mode="MANUAL_SYNC")
            res2 = ContestReconciliationService.reconcile_contest(21, db, sync_mode="MANUAL_SYNC")
            self.assertEqual(res1["audit"]["total_roster"], res2["audit"]["total_roster"])
            self.assertEqual(res1["audit"]["live_attended"], res2["audit"]["live_attended"])
            self.assertEqual(res1["audit"]["virtual_attended"], res2["audit"]["virtual_attended"])
            self.assertEqual(res1["audit"]["not_attended"], res2["audit"]["not_attended"])
            self.assertEqual(res1["audit"]["data_errors"], res2["audit"]["data_errors"])
        finally:
            db.close()

    # ─── TEST 9: 1,450 Roster Mathematical Reconciliation ─────────────────────
    def test_09_full_1450_roster_reconciliation(self):
        from backend.database import SessionLocal
        from backend.models import Student
        db = SessionLocal()
        try:
            total_roster = db.query(Student).filter((Student.is_active == True) | (Student.is_active.is_(None))).count()
            res = ContestReconciliationService.reconcile_contest(21, db)
            audit = res["audit"]
            self.assertEqual(audit["total_roster"], total_roster)
            self.assertTrue(audit["reconciliation_passed"])
            self.assertEqual(audit["live_attended"] + audit["virtual_attended"] + audit["not_attended"] + audit["data_errors"], total_roster)
        finally:
            db.close()

    # ─── TEST 10: Department Reconciliation ───────────────────────────────────
    def test_10_department_reconciliation(self):
        from backend.database import SessionLocal
        from backend.models import Student
        from backend.services.canonical_contest_engine import build_canonical_contest_dataset
        db = SessionLocal()
        try:
            total_roster = db.query(Student).filter((Student.is_active == True) | (Student.is_active.is_(None))).count()
            dataset = build_canonical_contest_dataset(21, db)
            dept_map = dataset["departmentStats"]
            dept_total_sum = sum(d["total"] for d in dept_map.values())
            self.assertEqual(dept_total_sum, total_roster)
            self.assertGreaterEqual(len(dept_map), 1)
        finally:
            db.close()

    # ─── TEST 11: Academic Year Reconciliation ────────────────────────────────
    def test_11_academic_year_reconciliation(self):
        from backend.database import SessionLocal
        from backend.models import Student
        from backend.services.canonical_contest_engine import build_canonical_contest_dataset
        db = SessionLocal()
        try:
            total_roster = db.query(Student).filter((Student.is_active == True) | (Student.is_active.is_(None))).count()
            dataset = build_canonical_contest_dataset(21, db)
            year_map = dataset["yearStats"]
            year_total_sum = sum(y["total"] for y in year_map.values())
            self.assertEqual(year_total_sum, total_roster)
        finally:
            db.close()

    # ─── TEST 12: Binary Q1-Q4 & Solved Invariant ─────────────────────────────
    def test_12_q1_q4_binary_validation(self):
        from backend.database import SessionLocal
        db = SessionLocal()
        try:
            res = ContestReconciliationService.reconcile_contest(21, db)
            for r in res["records"]:
                self.assertIn(r["q1"], (0, 1))
                self.assertIn(r["q2"], (0, 1))
                self.assertIn(r["q3"], (0, 1))
                self.assertIn(r["q4"], (0, 1))
                expected_sum = r["q1"] + r["q2"] + r["q3"] + r["q4"]
                if r["is_live"] or r["is_virtual"]:
                    self.assertEqual(r["total_solved"], expected_sum)
                else:
                    self.assertEqual(r["total_solved"], 0)
        finally:
            db.close()

    # ─── TEST 13: Manual Sync == Background Sync Equivalence ──────────────────
    def test_13_manual_and_background_sync_equivalence(self):
        from backend.database import SessionLocal
        db = SessionLocal()
        try:
            res_manual = ContestReconciliationService.reconcile_contest(21, db, sync_mode="MANUAL_SYNC")
            res_bg = ContestReconciliationService.reconcile_contest(21, db, sync_mode="BACKGROUND_SYNC")
            self.assertEqual(res_manual["audit"]["live_attended"], res_bg["audit"]["live_attended"])
            self.assertEqual(res_manual["audit"]["virtual_attended"], res_bg["audit"]["virtual_attended"])
            self.assertEqual(res_manual["audit"]["not_attended"], res_bg["audit"]["not_attended"])
        finally:
            db.close()

    # ─── TEST 14: Repeated Virtual Recheck ────────────────────────────────────
    def test_14_repeated_virtual_recheck_idempotence(self):
        from backend.database import SessionLocal
        db = SessionLocal()
        try:
            res_scan1 = ContestReconciliationService.reconcile_contest(21, db, sync_mode="VIRTUAL_RECHECK")
            res_scan2 = ContestReconciliationService.reconcile_contest(21, db, sync_mode="VIRTUAL_RECHECK")
            self.assertEqual(res_scan1["audit"]["virtual_attended"], res_scan2["audit"]["virtual_attended"])
            self.assertEqual(res_scan1["audit"]["reconciliation_passed"], True)
        finally:
            db.close()

    # ─── TEST 15: New Contest Automatically Resolved (e.g. 517, 518) ──────────
    def test_15_new_contest_automatic_resolution(self):
        meta_517 = ContestMetadataResolver.resolve_contest_metadata(517)
        meta_518 = ContestMetadataResolver.resolve_contest_metadata(518)

        self.assertEqual(meta_517["contest_num"], 517)
        self.assertEqual(meta_517["contest_id"], "weekly-contest-517")
        self.assertEqual(meta_517["contest_name"], "Weekly Contest 517")
        self.assertEqual(len(meta_517["problems"]), 4)

        self.assertEqual(meta_518["contest_num"], 518)
        self.assertEqual(meta_518["contest_id"], "weekly-contest-518")
        self.assertEqual(len(meta_518["problems"]), 4)

        # Test problem matching on new contest
        p1 = match_contest_problem(meta_517["problems"][0]["slug"], meta_517["problems"])
        self.assertIsNotNone(p1)
        self.assertEqual(p1["id"], "Q1")


if __name__ == "__main__":
    unittest.main()
