import os
import unittest
import datetime
import openpyxl
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.database import Base
from backend.models import Student, Department, LeetCodeProfileStats, StudentStatSnapshot
from backend.services.report_data_service import get_problem_category
from backend.services.weekly_report_service import generate_weekly_performance_data
from backend.exporters.weekly_excel_generator import build_weekly_performance_excel


class TestWeeklyReportEngine(unittest.TestCase):

    def setUp(self):
        # Setup in-memory SQLite database for testing
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(bind=self.engine)
        Session = sessionmaker(bind=self.engine)
        self.db = Session()

        # Seed test departments
        self.dept_cs = Department(id=1, name="Computer Science and Engineering (Cyber Security)", code="CSE(CS)")
        self.dept_iot = Department(id=2, name="Computer Science and Engineering (IoT)", code="CSE(IoT)")
        self.db.add_all([self.dept_cs, self.dept_iot])
        self.db.commit()

        # Seed test students across categories
        self.students_data = [
            ("732224CC001", "Student Above 500", "CSE(CS)", "III", "https://leetcode.com/u/user1/", "user1", 600, 300, 200, 100),
            ("732224CC002", "Student 500 Bound", "CSE(CS)", "III", "https://leetcode.com/u/user2/", "user2", 500, 250, 150, 100),
            ("732224CC003", "Student 250 Bound", "CSE(IoT)", "II",  "https://leetcode.com/u/user3/", "user3", 250, 150, 80, 20),
            ("732224CC004", "Student 101 Bound", "CSE(IoT)", "II",  "https://leetcode.com/u/user4/", "user4", 101, 60, 40, 1),
            ("732224CC005", "Student 100 Bound", "CSE(CS)", "IV",   "https://leetcode.com/u/user5/", "user5", 100, 50, 40, 10),
            ("732224CC006", "Student 1 Bound",   "CSE(CS)", "IV",   "https://leetcode.com/u/user6/", "user6", 1, 1, 0, 0),
            ("732224CC007", "Student 0 Solved",  "CSE(IoT)", "III", "https://leetcode.com/u/user7/", "user7", 0, 0, 0, 0),
            ("732224CC008", "Student Missing",   "CSE(IoT)", "II",  None, None, None, None, None, None),
        ]

        for reg, name, d_code, yr, url, uname, tot, ez, med, hd in self.students_data:
            dept_id = 1 if d_code == "CSE(CS)" else 2
            st = Student(reg_no=reg, name=name, department_id=dept_id, year_level=yr, leetcode_url=url, username=uname, is_active=True)
            self.db.add(st)
            self.db.commit()
            self.db.refresh(st)

            if tot is not None:
                stats = LeetCodeProfileStats(
                    student_id=st.id,
                    total_solved=tot,
                    easy_solved=ez,
                    medium_solved=med,
                    hard_solved=hd,
                    status="verified",
                    sync_status="success"
                )
            else:
                stats = LeetCodeProfileStats(
                    student_id=st.id,
                    total_solved=None,
                    status="pending",
                    sync_status="failed",
                    error_code="MISSING_LINK"
                )
            self.db.add(stats)
            self.db.commit()

    def tearDown(self):
        self.db.close()

    def test_category_boundary_assignment(self):
        """Verifies exact category boundaries: 0, 1, 100, 101, 250, 500, 501."""
        self.assertEqual(get_problem_category(501, True), "Above 500")
        self.assertEqual(get_problem_category(500, True), "250-500")
        self.assertEqual(get_problem_category(250, True), "250-500")
        self.assertEqual(get_problem_category(249, True), "101-250")
        self.assertEqual(get_problem_category(101, True), "101-250")
        self.assertEqual(get_problem_category(100, True), "Less than 100")
        self.assertEqual(get_problem_category(1, True), "Less than 100")
        self.assertEqual(get_problem_category(0, True), "Not Yet Started")
        self.assertEqual(get_problem_category(None, False), "Data Unavailable")

    def test_category_sum_validation_equation(self):
        """Verifies category totals == total students validation equation."""
        data = generate_weekly_performance_data(self.db, report_date="2026-08-13")
        total_st = data["total_students"]
        cats = data["categories"]
        sum_cats = (
            len(cats["above_500"]) +
            len(cats["250_500"]) +
            len(cats["101_250"]) +
            len(cats["less_100"]) +
            len(cats["not_started"]) +
            len(cats["unavailable"])
        )
        self.assertEqual(sum_cats, total_st)
        self.assertEqual(total_st, 8)

    def test_18_sheet_excel_structure(self):
        """Verifies generation of complete master 18-sheet workbook with 00_All_Students, 16_Fetch_Errors, and 18_Snapshot_Audit."""
        data = generate_weekly_performance_data(self.db, report_date="2026-08-13")
        test_file = "test_weekly_report.xlsx"
        try:
            build_weekly_performance_excel(data, test_file)
            self.assertTrue(os.path.exists(test_file))

            wb = openpyxl.load_workbook(test_file)
            self.assertIn("00_All_Students", wb.sheetnames)
            self.assertIn("04_Year_Summary", wb.sheetnames)
            self.assertIn("05_Department_Summary", wb.sheetnames)
            self.assertIn("06_Year_Department_Summary", wb.sheetnames)
            self.assertIn("10_Above_500", wb.sheetnames)
            self.assertIn("15_Fetch_Status", wb.sheetnames)
            self.assertIn("16_Fetch_Errors", wb.sheetnames)
            self.assertIn("17_Data_Validation", wb.sheetnames)
            self.assertIn("18_Snapshot_Audit", wb.sheetnames)
        finally:
            if os.path.exists(test_file):
                os.remove(test_file)


if __name__ == "__main__":
    unittest.main()
