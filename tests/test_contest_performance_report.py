import unittest
import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.database import Base
from backend.models import (
    Student, Department, Section, WeeklySession, WeeklyPublicResult, 
    WeeklyVirtualResult, ContestParticipation, ReportHistory
)
from backend.services.report_models import ReportConfig
from backend.services.contest_performance_service import build_contest_performance_report
from backend.services.contest_classifier import ContestStatus
from backend.exporters.excel_exporter import export_excel_from_dataset
from backend.exporters.csv_exporter import export_csv_from_dataset


class TestContestPerformanceReport(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool
        )
        cls.TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=cls.engine)
        Base.metadata.create_all(bind=cls.engine)

    @classmethod
    def tearDownClass(cls):
        Base.metadata.drop_all(bind=cls.engine)

    def setUp(self):
        self.db = self.TestingSessionLocal()
        # Clean all tables
        self.db.query(ReportHistory).delete()
        self.db.query(WeeklyPublicResult).delete()
        self.db.query(WeeklyVirtualResult).delete()
        self.db.query(ContestParticipation).delete()
        self.db.query(WeeklySession).delete()
        self.db.query(Student).delete()
        self.db.query(Department).delete()
        self.db.commit()

        # Seed Departments
        self.dept_cs = Department(name="Computer Science and Engineering (Cyber Security)", code="CSE(CS)")
        self.dept_iot = Department(name="Computer Science and Engineering (IoT)", code="CSE(IoT)")
        self.db.add_all([self.dept_cs, self.dept_iot])
        self.db.commit()
        self.db.refresh(self.dept_cs)
        self.db.refresh(self.dept_iot)

        # Seed Weekly Session 515 (Finalized)
        self.session_515 = WeeklySession(
            id=1,
            week_number=1,
            contest_name="Weekly Contest 515",
            contest_id="weekly-contest-515",
            session_date="16.08.2026",
            status="FINALIZED"
        )
        self.db.add(self.session_515)
        self.db.commit()
        self.db.refresh(self.session_515)

    def tearDown(self):
        self.db.close()

    def test_solve_distribution_and_student_statuses(self):
        """Tests 4, 3, 2, 1, 0 solve participants, public, virtual, not attended, pending, failed, invalid."""
        # 1. 4-solved Public Participant
        s1 = Student(name="STUDENT 4 SOLVE", reg_no="732224CC001", department_id=self.dept_cs.id, year_level="III", username="user_4s")
        # 2. 3-solved Public Participant
        s2 = Student(name="STUDENT 3 SOLVE", reg_no="732224CC002", department_id=self.dept_cs.id, year_level="III", username="user_3s")
        # 3. 2-solved Public Participant
        s3 = Student(name="STUDENT 2 SOLVE", reg_no="732224CC003", department_id=self.dept_cs.id, year_level="III", username="user_2s")
        # 4. 1-solved Public Participant
        s4 = Student(name="STUDENT 1 SOLVE", reg_no="732224CC004", department_id=self.dept_cs.id, year_level="III", username="user_1s")
        # 5. 0-solved Public Participant
        s5 = Student(name="STUDENT 0 SOLVE PUB", reg_no="732224CC005", department_id=self.dept_cs.id, year_level="III", username="user_0s_pub")
        # 6. 0-solved Virtual Participant
        s6 = Student(name="STUDENT 0 SOLVE VIRT", reg_no="732224CC006", department_id=self.dept_cs.id, year_level="III", username="user_0s_virt")
        # 7. Not Attended
        s7 = Student(name="STUDENT NOT ATTENDED", reg_no="732224CC007", department_id=self.dept_cs.id, year_level="III", username="user_not_att")
        # 8. Pending Username (no username)
        s8 = Student(name="STUDENT PENDING UNAME", reg_no="732224CC008", department_id=self.dept_cs.id, year_level="III", username="")
        # 9. Fetch Failed
        s9 = Student(name="STUDENT FETCH FAILED", reg_no="732224CC009", department_id=self.dept_cs.id, year_level="III", username="user_fetch_fail")
        # 10. Invalid Username
        s10 = Student(name="STUDENT INVALID UNAME", reg_no="732224CC010", department_id=self.dept_cs.id, year_level="III", username="user_inv_uname")

        self.db.add_all([s1, s2, s3, s4, s5, s6, s7, s8, s9, s10])
        self.db.commit()

        # Seed contest results
        r1 = WeeklyPublicResult(session_id=self.session_515.id, student_id=s1.id, reg_no=s1.reg_no, name=s1.name, dept="CSE(CS)", year="III", participation_status="PUBLIC_ATTENDED", q1=1, q2=1, q3=1, q4=1, total_contest_solved=4)
        r2 = WeeklyPublicResult(session_id=self.session_515.id, student_id=s2.id, reg_no=s2.reg_no, name=s2.name, dept="CSE(CS)", year="III", participation_status="PUBLIC_ATTENDED", q1=1, q2=1, q3=1, q4=0, total_contest_solved=3)
        r3 = WeeklyPublicResult(session_id=self.session_515.id, student_id=s3.id, reg_no=s3.reg_no, name=s3.name, dept="CSE(CS)", year="III", participation_status="PUBLIC_ATTENDED", q1=1, q2=1, q3=0, q4=0, total_contest_solved=2)
        r4 = WeeklyPublicResult(session_id=self.session_515.id, student_id=s4.id, reg_no=s4.reg_no, name=s4.name, dept="CSE(CS)", year="III", participation_status="PUBLIC_ATTENDED", q1=1, q2=0, q3=0, q4=0, total_contest_solved=1)
        r5 = WeeklyPublicResult(session_id=self.session_515.id, student_id=s5.id, reg_no=s5.reg_no, name=s5.name, dept="CSE(CS)", year="III", participation_status="PUBLIC_ATTENDED", q1=0, q2=0, q3=0, q4=0, total_contest_solved=0)
        
        # Virtual result with 0 solves
        r6_v = WeeklyVirtualResult(session_id=self.session_515.id, student_id=s6.id, reg_no=s6.reg_no, name=s6.name, participation_status="VIRTUAL_ATTENDED", q1=0, q2=0, q3=0, q4=0, total_contest_solved=0)

        # Not attended
        r7 = WeeklyPublicResult(session_id=self.session_515.id, student_id=s7.id, reg_no=s7.reg_no, name=s7.name, dept="CSE(CS)", year="III", participation_status="PUBLIC_NOT_ATTENDED")

        # Fetch Failed
        r9 = WeeklyPublicResult(session_id=self.session_515.id, student_id=s9.id, reg_no=s9.reg_no, name=s9.name, dept="CSE(CS)", year="III", fetch_status="FETCH_FAILED", participation_status="PENDING")

        # Invalid Username
        r10 = WeeklyPublicResult(session_id=self.session_515.id, student_id=s10.id, reg_no=s10.reg_no, name=s10.name, dept="CSE(CS)", year="III", fetch_status="INVALID_USERNAME", participation_status="PENDING")

        self.db.add_all([r1, r2, r3, r4, r5, r6_v, r7, r9, r10])
        self.db.commit()

        # Build report
        config = ReportConfig(report_type="CONTEST_PERFORMANCE", department="ALL", year="ALL")
        report = build_contest_performance_report(self.db, config)

        summary = report["contestSummary"]
        dist = report["solveDistribution"]

        # 1. Total Roster Check
        self.assertEqual(summary["totalStudents"], 10)
        self.assertEqual(summary["publicAttended"], 5)  # s1, s2, s3, s4, s5
        self.assertEqual(summary["virtualAttended"], 1)  # s6
        self.assertEqual(summary["notAttended"], 1)      # s7
        self.assertEqual(summary["pendingUsername"], 1)  # s8
        self.assertEqual(summary["fetchFailed"], 1)      # s9
        self.assertEqual(summary["invalidUsername"], 1)  # s10
        self.assertEqual(summary["totalParticipants"], 6) # 5 public + 1 virtual

        # 2. Solve Distribution Check
        self.assertEqual(dist["solved4"], 1)  # s1
        self.assertEqual(dist["solved3"], 1)  # s2
        self.assertEqual(dist["solved2"], 1)  # s3
        self.assertEqual(dist["solved1"], 1)  # s4
        self.assertEqual(dist["solved0"], 2)  # s5 (public with 0), s6 (virtual with 0)
        self.assertEqual(dist["atLeast1Solved"], 4) # 1+1+1+1
        self.assertEqual(dist["zeroSolvedParticipated"], 2)
        self.assertEqual(dist["notParticipated"], 1)

        # 3. Solved sum check: 4 + 3 + 2 + 1 + 0 + 0 = 10
        self.assertEqual(summary["totalContestSolved"], 10)

        # 4. Reconciliation
        self.assertTrue(report["reconciliation"]["isReconciled"])
        self.assertEqual(report["reconciliation"]["totalRoster"], 10)
        self.assertEqual(report["reconciliation"]["sumStatuses"], 10)
        self.assertEqual(report["reconciliation"]["totalParticipants"], 6)
        self.assertEqual(report["reconciliation"]["sumSolveDistribution"], 6)

        # 5. Row check: NOT_ATTENDED must have Q1-Q4 = None and contest_solved = None
        s7_row = next(r for r in report["allStudents"] if r["reg_no"] == "732224CC007")
        self.assertEqual(s7_row["status"], "NOT_ATTENDED")
        self.assertIsNone(s7_row["q1"])
        self.assertIsNone(s7_row["q2"])
        self.assertIsNone(s7_row["q3"])
        self.assertIsNone(s7_row["q4"])
        self.assertIsNone(s7_row["contest_solved"])

        # 6. Row check: 0-solve Virtual participant must have Q1-Q4 = 0 and contest_solved = 0
        s6_row = next(r for r in report["allStudents"] if r["reg_no"] == "732224CC006")
        self.assertEqual(s6_row["status"], "VIRTUAL_ATTENDED")
        self.assertEqual(s6_row["q1"], 0)
        self.assertEqual(s6_row["q2"], 0)
        self.assertEqual(s6_row["q3"], 0)
        self.assertEqual(s6_row["q4"], 0)
        self.assertEqual(s6_row["contest_solved"], 0)

        # 7. Row check: 3-solve participant must have Q1=1, Q2=1, Q3=1, Q4=0 and contest_solved = 3
        s2_row = next(r for r in report["allStudents"] if r["reg_no"] == "732224CC002")
        self.assertEqual(s2_row["status"], "PUBLIC_ATTENDED")
        self.assertEqual(s2_row["q1"], 1)
        self.assertEqual(s2_row["q2"], 1)
        self.assertEqual(s2_row["q3"], 1)
        self.assertEqual(s2_row["q4"], 0)
        self.assertEqual(s2_row["contest_solved"], 3)

    def test_department_and_year_filtering(self):
        """Tests that filtering by Department, Year, and Department+Year returns only matching subsets."""
        # CS Year II (2 students)
        cs_ii_1 = Student(name="CS II 1", reg_no="CS201", department_id=self.dept_cs.id, year_level="II", username="cs201")
        cs_ii_2 = Student(name="CS II 2", reg_no="CS202", department_id=self.dept_cs.id, year_level="II", username="cs202")
        # CS Year III (2 students)
        cs_iii_1 = Student(name="CS III 1", reg_no="CS301", department_id=self.dept_cs.id, year_level="III", username="cs301")
        cs_iii_2 = Student(name="CS III 2", reg_no="CS302", department_id=self.dept_cs.id, year_level="III", username="cs302")
        # IoT Year II (2 students)
        iot_ii_1 = Student(name="IOT II 1", reg_no="IOT201", department_id=self.dept_iot.id, year_level="II", username="iot201")
        iot_ii_2 = Student(name="IOT II 2", reg_no="IOT202", department_id=self.dept_iot.id, year_level="II", username="iot202")
        # IoT Year III (2 students)
        iot_iii_1 = Student(name="IOT III 1", reg_no="IOT301", department_id=self.dept_iot.id, year_level="III", username="iot301")
        iot_iii_2 = Student(name="IOT III 2", reg_no="IOT302", department_id=self.dept_iot.id, year_level="III", username="iot302")

        self.db.add_all([cs_ii_1, cs_ii_2, cs_iii_1, cs_iii_2, iot_ii_1, iot_ii_2, iot_iii_1, iot_iii_2])
        self.db.commit()

        # Add participation for CS III 1 (3 solves) and IOT II 1 (2 solves)
        p1 = WeeklyPublicResult(session_id=self.session_515.id, student_id=cs_iii_1.id, reg_no="CS301", name="CS III 1", dept="CSE(CS)", year="III", participation_status="PUBLIC_ATTENDED", q1=1, q2=1, q3=1, q4=0, total_contest_solved=3)
        p2 = WeeklyPublicResult(session_id=self.session_515.id, student_id=iot_ii_1.id, reg_no="IOT201", name="IOT II 1", dept="CSE(IoT)", year="II", participation_status="PUBLIC_ATTENDED", q1=1, q2=1, q3=0, q4=0, total_contest_solved=2)
        self.db.add_all([p1, p2])
        self.db.commit()

        # 1. Filter: Department CSE(CS) only (all years) -> 4 students
        rep_cs = build_contest_performance_report(self.db, ReportConfig(report_type="CONTEST_PERFORMANCE", department="CSE(CS)", year="ALL", output_scope="DEPARTMENT"))
        self.assertEqual(rep_cs["contestSummary"]["totalStudents"], 4)
        self.assertEqual(rep_cs["contestSummary"]["publicAttended"], 1)
        self.assertEqual(rep_cs["contestSummary"]["notAttended"], 3)
        self.assertEqual(rep_cs["solveDistribution"]["solved3"], 1)

        # 2. Filter: Year III only (all departments) -> 4 students
        rep_iii = build_contest_performance_report(self.db, ReportConfig(report_type="CONTEST_PERFORMANCE", department="ALL", year="III", output_scope="YEAR"))
        self.assertEqual(rep_iii["contestSummary"]["totalStudents"], 4)
        self.assertEqual(rep_iii["contestSummary"]["publicAttended"], 1)
        self.assertEqual(rep_iii["contestSummary"]["notAttended"], 3)

        # 3. Filter: CSE(CS) + Year III -> 2 students
        rep_cs_iii = build_contest_performance_report(self.db, ReportConfig(report_type="CONTEST_PERFORMANCE", department="CSE(CS)", year="III", output_scope="DEPT_YEAR"))
        self.assertEqual(rep_cs_iii["contestSummary"]["totalStudents"], 2)
        self.assertEqual(rep_cs_iii["contestSummary"]["publicAttended"], 1)
        self.assertEqual(rep_cs_iii["contestSummary"]["notAttended"], 1)
        self.assertEqual(len(rep_cs_iii["allStudents"]), 2)

        # 4. Filter: CSE(IoT) + Year II -> 2 students
        rep_iot_ii = build_contest_performance_report(self.db, ReportConfig(report_type="CONTEST_PERFORMANCE", department="CSE(IoT)", year="II", output_scope="DEPT_YEAR"))
        self.assertEqual(rep_iot_ii["contestSummary"]["totalStudents"], 2)
        self.assertEqual(rep_iot_ii["contestSummary"]["publicAttended"], 1)
        self.assertEqual(rep_iot_ii["contestSummary"]["notAttended"], 1)
        self.assertEqual(rep_iot_ii["solveDistribution"]["solved2"], 1)

    def test_latest_contest_switching(self):
        """Tests that adding a new finalized session (e.g. Contest 516) automatically switches the report."""
        # Initially on Contest 515
        rep1 = build_contest_performance_report(self.db, ReportConfig(report_type="CONTEST_PERFORMANCE", department="ALL", year="ALL"))
        self.assertEqual(rep1["contestName"], "Weekly Contest 515")

        # Now finalize Weekly Contest 516
        session_516 = WeeklySession(
            id=2,
            week_number=2,
            contest_name="Weekly Contest 516",
            contest_id="weekly-contest-516",
            session_date="23.08.2026",
            status="FINALIZED"
        )
        self.db.add(session_516)
        self.db.commit()

        # Next report generation must automatically resolve Weekly Contest 516
        rep2 = build_contest_performance_report(self.db, ReportConfig(report_type="CONTEST_PERFORMANCE", department="ALL", year="ALL"))
        self.assertEqual(rep2["contestName"], "Weekly Contest 516")
        self.assertEqual(rep2["sessionDate"], "23.08.2026")

    def test_export_compatibility(self):
        """Tests that export_excel_from_dataset and export_csv_from_dataset work cleanly on report output."""
        s = Student(name="ALICE", reg_no="732224CC999", department_id=self.dept_cs.id, year_level="III", username="alice")
        self.db.add(s)
        self.db.commit()

        res = WeeklyPublicResult(session_id=self.session_515.id, student_id=s.id, reg_no=s.reg_no, name=s.name, dept="CSE(CS)", year="III", participation_status="PUBLIC_ATTENDED", q1=1, q2=1, q3=0, q4=0, total_contest_solved=2)
        self.db.add(res)
        self.db.commit()

        rep = build_contest_performance_report(self.db, ReportConfig(report_type="CONTEST_PERFORMANCE", department="ALL", year="ALL"))
        
        # Excel export
        excel_bytes = export_excel_from_dataset(rep)
        self.assertIsInstance(excel_bytes, bytes)
        self.assertGreater(len(excel_bytes), 1000)

        # CSV export
        csv_bytes = export_csv_from_dataset(rep)
        self.assertIsInstance(csv_bytes, bytes)
        self.assertGreater(len(csv_bytes), 50)
        self.assertIn(b"ALICE", csv_bytes)
        self.assertIn(b"732224CC999", csv_bytes)


if __name__ == "__main__":
    unittest.main()
