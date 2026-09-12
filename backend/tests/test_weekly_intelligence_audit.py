import unittest
import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.database import Base
from backend.models import Student, Department, LeetCodeProfileStats, WeeklySession, WeeklyPublicResult, WeeklyStudentSnapshot
from backend.services.weekly_intelligence_service import generate_live_weekly_intelligence_data
from backend.services.report_validators import reconcile_report_dataset
from backend.pdf_generator import generate_pdf_report


class TestWeeklyIntelligenceAudit(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(bind=self.engine)
        Session = sessionmaker(bind=self.engine)
        self.db = Session()

        # Create production departments
        self.dept_cse = Department(code="CSE", name="Computer Science & Engineering")
        self.dept_cs = Department(code="CSE(CS)", name="Computer Science & Engineering (Cyber Security)")
        self.dept_iot = Department(code="CSE(IoT)", name="Computer Science & Engineering (Internet of Things)")
        self.db.add_all([self.dept_cse, self.dept_cs, self.dept_iot])
        self.db.commit()

        # Seed students with valid & missing ratings
        self.s1 = Student(reg_no="732224CSE001", name="Student One", department_id=self.dept_cse.id, year_level="III", username="user1", is_active=True)
        self.s2 = Student(reg_no="732224CS001", name="Student Two", department_id=self.dept_cs.id, year_level="III", username="user2", is_active=True)
        self.s3 = Student(reg_no="732224IOT001", name="Student Three", department_id=self.dept_iot.id, year_level="II", username="user3", is_active=True)
        self.db.add_all([self.s1, self.s2, self.s3])
        self.db.commit()

        # Seed profile stats (s1 has valid rating 1650, s2 has unrated/None, s3 has 1500 default which should be ignored)
        self.db.add_all([
            LeetCodeProfileStats(student_id=self.s1.id, total_solved=150, easy_solved=100, medium_solved=40, hard_solved=10, contest_rating=1650.5, status="verified"),
            LeetCodeProfileStats(student_id=self.s2.id, total_solved=80, easy_solved=60, medium_solved=20, hard_solved=0, contest_rating=None, status="verified"),
            LeetCodeProfileStats(student_id=self.s3.id, total_solved=0, easy_solved=0, medium_solved=0, hard_solved=0, contest_rating=1500.0, status="pending")
        ])
        self.db.commit()

        # Seed completed past session (Contest 518) and upcoming future session (Contest 519)
        self.session_past = WeeklySession(contest_name="Weekly Contest 518", session_date="06.09.2026", status="FINALIZED")
        self.session_future = WeeklySession(contest_name="Weekly Contest 519", session_date="20.09.2026", status="SCHEDULED")
        self.db.add_all([self.session_past, self.session_future])
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def test_future_contest_state_and_attendance(self):
        """Future contest must not be treated as completed contest performance."""
        live_data = generate_live_weekly_intelligence_data(self.db)
        reporting_win = live_data["report_metadata"]["reporting_window"]
        curr_session_date = reporting_win["current_week"]["session_date"]
        
        # Verify completed past contest is resolved
        self.assertIn("W518", reporting_win["window_str"])
        self.assertNotIn("W519", reporting_win["window_str"])

    def test_missing_rating_not_converted_to_1500(self):
        """1500 default rating must be ignored, returning None ('Not Available')."""
        live_data = generate_live_weekly_intelligence_data(self.db)
        students = live_data["student_3_week_comparison"]
        
        s1_data = next(s for s in students if s["reg_no"] == "732224CSE001")
        s2_data = next(s for s in students if s["reg_no"] == "732224CS001")
        s3_data = next(s for s in students if s["reg_no"] == "732224IOT001")

        self.assertEqual(s1_data["contest_rating"], 1650.5)
        self.assertIsNone(s2_data["contest_rating"])
        self.assertIsNone(s3_data["contest_rating"])  # 1500 default converted to None!

    def test_historical_snapshot_independence(self):
        """Missing past snapshot returns None ('Insufficient historical data') instead of duplicating current value."""
        live_data = generate_live_weekly_intelligence_data(self.db)
        students = live_data["student_3_week_comparison"]
        s1_data = next(s for s in students if s["reg_no"] == "732224CSE001")
        
        # No past snapshot seeded -> prev_prev_solved must be None
        self.assertIsNone(s1_data["prev_prev_solved"])
        self.assertIsNone(s1_data["weekly_delta"])
        self.assertIsNone(s1_data["growth_pct"])

    def test_data_reconciliation_gate(self):
        """Cross-table totals must reconcile perfectly."""
        live_data = generate_live_weekly_intelligence_data(self.db)
        reconciliation = reconcile_report_dataset(live_data)
        
        self.assertTrue(reconciliation["is_valid"])
        self.assertEqual(reconciliation["official_status"], "OFFICIAL")
        self.assertEqual(reconciliation["total_students"], 3)
        self.assertEqual(reconciliation["dept_sum"], 3)
        self.assertEqual(reconciliation["year_sum"], 3)

    def test_pdf_generation_bytes(self):
        """PDF generation must return valid PDF bytes."""
        pdf_bytes = generate_pdf_report(self.db)
        self.assertIsInstance(pdf_bytes, bytes)
        self.assertGreater(len(pdf_bytes), 5000)


if __name__ == "__main__":
    unittest.main()
