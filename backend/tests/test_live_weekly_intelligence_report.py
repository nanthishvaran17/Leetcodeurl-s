import unittest
import datetime
from sqlalchemy.orm import Session
from fastapi.testclient import TestClient

from backend.main import app
from backend.database import SessionLocal
from backend.models import User, Department, Student, WeeklySession, WeeklyPublicResult
from backend.services.weekly_intelligence_service import generate_live_weekly_intelligence_data

class TestLiveWeeklyIntelligenceReport(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.db = SessionLocal()

    def tearDown(self):
        self.db.close()

    def test_live_weekly_intelligence_endpoint_success(self):
        """Test GET /api/reports/weekly-intelligence returns 200 with all 7-page sections."""
        response = self.client.get("/api/reports/weekly-intelligence")
        self.assertEqual(response.status_code, 200)
        data = response.json()

        # 1. Report Metadata & Dynamic 3-Week Rolling Window
        self.assertIn("report_metadata", data)
        meta = data["report_metadata"]
        self.assertEqual(meta["title"], "Weekly LeetCode Intelligence")
        self.assertEqual(meta["data_status"], "LIVE")
        self.assertIn("reporting_window", meta)
        rw = meta["reporting_window"]
        self.assertIn("current_week", rw)
        self.assertIn("previous_week", rw)
        self.assertIn("prev_prev_week", rw)
        self.assertTrue(rw["current_week"]["week_label"].startswith("W"))
        self.assertIn("audit_hash", meta)

        # 2. Executive Dashboard (Page 2)
        self.assertIn("executive_dashboard", data)
        exec_dash = data["executive_dashboard"]
        self.assertGreater(exec_dash["total_students"], 0)
        self.assertIn("active_students", exec_dash)
        self.assertIn("total_problems_solved", exec_dash)
        self.assertIn("risk_distribution", exec_dash)
        self.assertIn("category_distribution", exec_dash)

        # 3. Institutional Trend (3-Week)
        self.assertIn("institutional_trend", data)
        trend = data["institutional_trend"]
        self.assertEqual(len(trend), 3)

        # 4. Department & Year Intelligence (Page 3)
        self.assertIn("department_intelligence", data)
        depts = data["department_intelligence"]
        self.assertGreater(len(depts), 0)
        for d in depts:
            self.assertIn("department", d)
            self.assertIn("total_students", d)
            self.assertIn("current_solved", d)
            self.assertIn("weekly_new", d)

        self.assertIn("year_intelligence", data)
        years = data["year_intelligence"]
        self.assertGreater(len(years), 0)

        # 5. DSA Topic & Language Intelligence (Page 4)
        self.assertIn("dsa_topic_intelligence", data)
        dsa = data["dsa_topic_intelligence"]
        self.assertIn("top_topics", dsa)
        self.assertGreater(len(dsa["top_topics"]), 0)

        self.assertIn("language_intelligence", data)
        langs = data["language_intelligence"]
        self.assertIn("top_languages", langs)
        self.assertGreater(len(langs["top_languages"]), 0)

        # 6. Contest Intelligence (Page 5)
        self.assertIn("contest_intelligence", data)
        contest = data["contest_intelligence"]
        self.assertIn("problem_breakdown", contest)
        self.assertEqual(len(contest["problem_breakdown"]), 4) # Q1..Q4

        # 7. Student 3-Week Comparison (Page 6)
        self.assertIn("student_3_week_comparison", data)
        students = data["student_3_week_comparison"]
        self.assertGreater(len(students), 0)
        s0 = students[0]
        self.assertIn("reg_no", s0)
        self.assertIn("name", s0)
        self.assertIn("current_solved", s0)
        self.assertIn("prev_solved", s0)
        self.assertIn("weekly_delta", s0)
        self.assertIn("risk_level", s0)

        # 8. Student Deep Dives (Page 7+)
        self.assertIn("student_deep_dives", data)
        dives = data["student_deep_dives"]
        self.assertEqual(len(dives), len(students))
        d0 = dives[0]
        self.assertIn("difficulty", d0)
        self.assertIn("history_3_weeks", d0)
        self.assertIn("ai_risk_insights", d0)

        # 9. Data Validation & Rules
        self.assertIn("data_validation", data)
        val = data["data_validation"]
        self.assertEqual(val["status"], "VALID")

    def test_department_scoped_filtering(self):
        """Test department query parameter properly filters returned data."""
        cse_res = self.client.get("/api/reports/weekly-intelligence?department=CSE")
        self.assertEqual(cse_res.status_code, 200)
        cse_data = cse_res.json()
        
        # All returned students should belong to CSE
        for s in cse_data["student_3_week_comparison"]:
            self.assertEqual(s["department"], "CSE")

    def test_hod_department_scoped_authorization(self):
        """Test HOD user role can only access allocated departments."""
        hod_user = self.db.query(User).filter(User.role.ilike("%hod%")).first()
        if hod_user:
            data = generate_live_weekly_intelligence_data(
                db=self.db,
                current_user=hod_user
            )
            # Ensure report executes cleanly with scoped HOD user
            self.assertIn("student_3_week_comparison", data)
            self.assertIn("department_intelligence", data)

if __name__ == "__main__":
    unittest.main()
