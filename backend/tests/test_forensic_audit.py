"""
test_forensic_audit.py — Unit and integration tests for Institutional Forensic Audit Engine.
Uses standard unittest library for zero-dependency test execution.
"""

import unittest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.models import (
    Base,
    Student,
    Department,
    LeetCodeContestRatingHistory,
    ForensicAuditJob,
    ForensicStudentIngestStatus,
    ForensicAuditRecord,
)
from backend.services.forensic_audit_service import (
    get_canonical_100_contests,
    execute_phase2_matrix,
    clean_student_username,
)


class TestForensicAuditEngine(unittest.TestCase):

    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(bind=self.engine)
        Session = sessionmaker(bind=self.engine)
        self.session = Session()

        dept = Department(name="Computer Science", code="CSE")
        self.session.add(dept)
        self.session.commit()

        s1 = Student(reg_no="2026001", name="Student One", department_id=dept.id, year_level="III", username="student_one")
        s2 = Student(reg_no="2026002", name="Student Two", department_id=dept.id, year_level="III", username="invalid_user_999")
        s3 = Student(reg_no="2026003", name="Student Three", department_id=dept.id, year_level="III", username=None)
        self.session.add_all([s1, s2, s3])
        self.session.commit()

    def tearDown(self):
        self.session.close()

    def test_canonical_100_contests_derivation(self):
        contests = get_canonical_100_contests()
        self.assertEqual(len(contests), 100)
        self.assertEqual(contests[0]["contest_number"], 416)
        self.assertEqual(contests[0]["contest_id"], "weekly-contest-416")
        self.assertEqual(contests[0]["contest_name"], "Weekly Contest 416")
        self.assertEqual(contests[0]["contest_date"], "2024-09-22")

        self.assertEqual(contests[98]["contest_number"], 514)
        self.assertEqual(contests[98]["contest_date"], "2026-08-09")

        self.assertEqual(contests[99]["contest_number"], 515)
        self.assertEqual(contests[99]["contest_id"], "weekly-contest-515")
        self.assertEqual(contests[99]["contest_name"], "Weekly Contest 515")
        self.assertEqual(contests[99]["contest_date"], "2026-08-16")

    def test_clean_student_username(self):
        s1 = Student(username="  johndoe/ ")
        s2 = Student(leetcode_url="https://leetcode.com/janedoe/")
        s3 = Student(username=None, leetcode_url=None)

        self.assertEqual(clean_student_username(s1), "johndoe")
        self.assertEqual(clean_student_username(s2), "janedoe")
        self.assertIsNone(clean_student_username(s3))

    def test_phase2_matrix_resolution_and_integrity(self):
        job_id = "TEST-FAJ-001"
        job = ForensicAuditJob(job_id=job_id, status="RUNNING", phase="INGEST")
        self.session.add(job)
        self.session.commit()

        s1 = self.session.query(Student).filter(Student.username == "student_one").first()
        s2 = self.session.query(Student).filter(Student.username == "invalid_user_999").first()
        s3 = self.session.query(Student).filter(Student.username.is_(None)).first()

        # Simulate Phase 1 Ingest Statuses
        st1 = ForensicStudentIngestStatus(job_id=job_id, student_id=s1.id, ingest_status="SUCCESS", canonical_username="student_one")
        st2 = ForensicStudentIngestStatus(job_id=job_id, student_id=s2.id, ingest_status="NOT_FOUND")
        st3 = ForensicStudentIngestStatus(job_id=job_id, student_id=s3.id, ingest_status="PENDING_USERNAME")
        self.session.add_all([st1, st2, st3])

        # Add 1 history record for Student 1 (Weekly Contest 514 attended, solved 3)
        hist1 = LeetCodeContestRatingHistory(
            student_id=s1.id,
            contest_name="Weekly Contest 514",
            contest_type="weekly",
            attended=True,
            problems_solved=3,
            contest_rank=1250,
            rating_after=1650.5,
        )
        self.session.add(hist1)
        self.session.commit()

        # Execute Phase 2 Matrix
        execute_phase2_matrix(job_id, self.session)

        # 3 Students × 100 Contests = 300 total cells
        self.assertEqual(job.total_matrix_cells, 300)
        self.assertEqual(job.cells_processed, 300)
        self.assertEqual(job.verified_attended, 1)
        self.assertEqual(job.verified_absent, 99)  # Student 1 for remaining 99 contests
        self.assertEqual(job.not_found_count, 100)  # Student 2 for 100 contests
        self.assertEqual(job.pending_username_count, 100)  # Student 3 for 100 contests

        # Verify Q1-Q4 are strictly NULL
        records = self.session.query(ForensicAuditRecord).filter(ForensicAuditRecord.job_id == job_id).all()
        self.assertEqual(len(records), 300)
        for r in records:
            self.assertIsNone(r.q1_solved)
            self.assertIsNone(r.q2_solved)
            self.assertIsNone(r.q3_solved)
            self.assertIsNone(r.q4_solved)

        # Check attended record
        att_rec = self.session.query(ForensicAuditRecord).filter(
            ForensicAuditRecord.job_id == job_id,
            ForensicAuditRecord.student_id == s1.id,
            ForensicAuditRecord.contest_id == "weekly-contest-514"
        ).first()
        self.assertIsNotNone(att_rec)
        self.assertEqual(att_rec.verification_status, "VERIFIED_ATTENDED")
        self.assertTrue(att_rec.attended)
        self.assertEqual(att_rec.problems_solved, 3)
        self.assertEqual(att_rec.contest_rank, 1250)
        self.assertEqual(att_rec.contest_rating, 1650.5)

    def test_database_connection_stress_and_session_leak_prevention(self):
        import asyncio
        from backend.services.forensic_audit_service import execute_phase1_ingest, get_checked_out_connections

        job_id = "STRESS-FAJ-001"
        job = ForensicAuditJob(job_id=job_id, status="RUNNING", phase="INGEST")
        self.session.add(job)
        self.session.commit()

        # Run Phase 1 on memory DB
        asyncio.run(execute_phase1_ingest(job_id, self.session))

        # Check checked out connections is 0
        checked_out = get_checked_out_connections()
        self.assertEqual(checked_out, 0, f"Expected 0 checked out DB connections, found {checked_out}")


if __name__ == "__main__":
    unittest.main()

