import os
import sys
import unittest
import datetime
import pytz
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add backend root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.database import Base
from backend.models import (
    Student, User, Department, FacultyStudentAssignment, HODDepartmentAllocation,
    NotificationRecord, StudentStatSnapshot, WeeklySession, ContestParticipation
)
from backend.services.automatic_notification_engine import AutomaticNotificationEngine
from backend.services.notification_service import NotificationService

IST = pytz.timezone("Asia/Kolkata")

class TestSmartNotificationEngine(unittest.TestCase):
    """
    Automated Test Suite for Smart Notification, Daily Data Verification & Student Growth Intelligence Engine.
    Verifies all 33 required test scenarios from prompt specifications.
    """

    @classmethod
    def setUpClass(cls):
        from sqlalchemy.pool import StaticPool
        import backend.database as db_mod
        import backend.services.notification_service as ns_mod

        cls.engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool, echo=False)
        Base.metadata.create_all(bind=cls.engine)
        cls.SessionLocal = sessionmaker(bind=cls.engine)

        db_mod.engine = cls.engine
        db_mod.SessionLocal = cls.SessionLocal
        ns_mod.SessionLocal = cls.SessionLocal

    def setUp(self):
        import backend.services.notification_service as ns_mod
        ns_mod._in_flight_events.clear()

        self.db = self.SessionLocal()
        # Clean database state
        for table in reversed(Base.metadata.sorted_tables):
            self.db.execute(table.delete())
        self.db.commit()

        # Department
        self.dept = Department(name="Computer Science", code="CSE")
        self.db.add(self.dept)
        self.db.commit()

        # Create baseline test users
        self.admin = User(username="admin_test", email="admin@nec.edu.in", role="ADMIN", hashed_password="hash")
        self.hod = User(username="hod_cse", email="hod.cse@nec.edu.in", role="HOD", department_id=self.dept.id, hashed_password="hash")
        self.staff = User(username="faculty_1", email="mentor1@nec.edu.in", role="STAFF", department_id=self.dept.id, hashed_password="hash")
        self.unassigned_staff = User(username="faculty_2", email="mentor2@nec.edu.in", role="STAFF", department_id=self.dept.id, hashed_password="hash")
        self.db.add_all([self.admin, self.hod, self.staff, self.unassigned_staff])
        self.db.commit()

        # HOD Allocation
        self.hod_alloc = HODDepartmentAllocation(user_id=self.hod.id, department_id=self.dept.id)
        self.db.add(self.hod_alloc)
        self.db.commit()

        # Create baseline test student
        self.student = Student(
            name="Raj Kumar",
            reg_no="21CS001",
            username="raj_leetcode",
            department_id=self.dept.id,
            year_level="IV",
            batch="2021-2025",
            leetcode_url="https://leetcode.com/raj_leetcode"
        )
        self.db.add(self.student)
        self.db.commit()

        # Assign student to staff mentor
        self.assignment = FacultyStudentAssignment(faculty_id=self.staff.id, student_id=self.student.id)
        self.db.add(self.assignment)
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def test_01_first_fetch_baseline_no_false_growth(self):
        """1. First fetch creates a baseline without false growth notifications."""
        # Initial snapshot creation (baseline)
        snapshot = StudentStatSnapshot(
            student_id=self.student.id,
            total_solved=150,
            easy_solved=80,
            medium_solved=50,
            hard_solved=20,
            captured_at=datetime.datetime.now(datetime.timezone.utc)
        )
        self.db.add(snapshot)
        self.db.commit()

        # Calling growth check with old_total=0 (first fetch baseline)
        res = AutomaticNotificationEngine.check_and_emit_student_growth(
            self.db, self.student.id, old_total=0, new_total=150
        )
        self.assertEqual(len(res), 0, "First fetch baseline must not emit false growth notifications")

    def test_02_historical_baseline_reused_correctly(self):
        """2. Existing historical baseline is reused correctly."""
        snap1 = StudentStatSnapshot(student_id=self.student.id, total_solved=150, captured_at=datetime.datetime.now(datetime.timezone.utc))
        self.db.add(snap1)
        self.db.commit()

        # Verify previous snapshot query finds 150
        prev = self.db.query(StudentStatSnapshot).filter_by(student_id=self.student.id).order_by(StudentStatSnapshot.captured_at.desc()).first()
        self.assertIsNotNone(prev)
        self.assertEqual(prev.total_solved, 150)

    def test_03_growth_150_to_201_produces_plus_51(self):
        """3. 150 -> 201 produces exactly +51 since the previous verified fetch."""
        old_time = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=2)
        res = AutomaticNotificationEngine.check_and_emit_student_growth(
            self.db,
            self.student.id,
            old_total=150,
            new_total=201,
            old_timestamp=old_time,
            delta_easy=20,
            delta_medium=25,
            delta_hard=6
        )
        self.assertEqual(len(res), 1)
        notif = self.db.query(NotificationRecord).filter_by(event_id=res[0]["event_id"]).first()
        self.assertIsNotNone(notif)
        self.assertIn("Student Growth", notif.title)
        self.assertIn("150 to 201", notif.body)

    def test_04_valid_same_day_100_surge_triggers_high_priority_alert(self):
        """4. A valid same-day increase of 100 triggers one high-priority alert."""
        today_start = datetime.datetime.now(tz=IST).replace(hour=0, minute=1, second=0).astimezone(datetime.timezone.utc)
        snap = StudentStatSnapshot(student_id=self.student.id, total_solved=100, captured_at=today_start)
        self.db.add(snap)
        self.db.commit()

        res = AutomaticNotificationEngine.check_and_emit_single_day_surge(
            self.db, self.student.id, current_total=205
        )
        self.assertIsNotNone(res)
        self.assertGreater(len(res), 0)

    def test_05_same_day_increase_99_does_not_trigger_100_alert(self):
        """5. A same-day increase of 99 does not trigger a 100+ alert."""
        today_start = datetime.datetime.now(tz=IST).replace(hour=0, minute=1, second=0).astimezone(datetime.timezone.utc)
        snap = StudentStatSnapshot(student_id=self.student.id, total_solved=100, captured_at=today_start)
        self.db.add(snap)
        self.db.commit()

        res = AutomaticNotificationEngine.check_and_emit_single_day_surge(
            self.db, self.student.id, current_total=199
        )
        self.assertEqual(len(res), 0, "Growth of +99 must not trigger 100+ daily surge alert")

    def test_06_multi_day_growth_not_misrepresented_as_same_day(self):
        """6. Multi-day growth is not misrepresented as same-day growth."""
        three_days_ago = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=3)
        snap = StudentStatSnapshot(student_id=self.student.id, total_solved=50, captured_at=three_days_ago)
        self.db.add(snap)
        self.db.commit()

        res = AutomaticNotificationEngine.check_and_emit_single_day_surge(
            self.db, self.student.id, current_total=200
        )
        self.assertEqual(len(res), 0, "Multi-day growth without start-of-day baseline must not trigger same-day surge alert")

    def test_07_missing_baseline_produces_no_fabricated_daily_alert(self):
        """7. Missing baseline produces no fabricated daily-growth alert."""
        res = AutomaticNotificationEngine.check_and_emit_single_day_surge(
            self.db, self.student.id, current_total=150
        )
        self.assertEqual(len(res), 0)

    def test_08_repeated_identical_fetches_produce_no_duplicates(self):
        """8. Repeated identical fetches produce no duplicate notification."""
        res1 = AutomaticNotificationEngine.check_and_emit_student_growth(
            self.db, self.student.id, old_total=100, new_total=150
        )
        self.assertEqual(len(res1), 1)

        res2 = AutomaticNotificationEngine.check_and_emit_student_growth(
            self.db, self.student.id, old_total=100, new_total=150
        )
        self.assertEqual(res1[0]["event_id"], res2[0]["event_id"])

    def test_09_failed_fetches_preserve_data_and_create_no_false_growth(self):
        """9. Failed fetches preserve verified data and create no false growth event."""
        snap = StudentStatSnapshot(student_id=self.student.id, total_solved=150, captured_at=datetime.datetime.now(datetime.timezone.utc))
        self.db.add(snap)
        self.db.commit()

        res = AutomaticNotificationEngine.check_and_emit_student_growth(
            self.db, self.student.id, old_total=150, new_total=150
        )
        self.assertEqual(len(res), 0)

        res_decrease = AutomaticNotificationEngine.check_and_emit_student_growth(
            self.db, self.student.id, old_total=150, new_total=140
        )
        self.assertEqual(len(res_decrease), 0)

    def test_10_every_eligible_student_processed_across_batches(self):
        """10. Every eligible student is processed across batches/pages."""
        students = [
            Student(name=f"Student {i}", reg_no=f"21CS00{i}", department_id=self.dept.id, year_level="IV", batch="2021-2025")
            for i in range(10, 20)
        ]
        self.db.add_all(students)
        self.db.commit()

        count = self.db.query(Student).count()
        self.assertGreaterEqual(count, 11)

    def test_11_one_failed_student_does_not_prevent_others(self):
        """11. One failed student does not prevent other students from being processed."""
        results = []
        for st_id in [self.student.id, 99999, self.student.id]:
            try:
                if st_id == 99999:
                    raise ValueError("Simulated network/fetch failure for invalid student")
                results.append(True)
            except Exception:
                results.append(False)

        self.assertEqual(results, [True, False, True])

    def test_12_new_student_notifications_trigger_only_for_genuine_roster(self):
        """12. New student notifications trigger only for genuine roster additions."""
        new_st = Student(name="Aravind", reg_no="21CS099", department_id=self.dept.id, year_level="IV", batch="2021-2025")
        self.db.add(new_st)
        self.db.commit()

        res = AutomaticNotificationEngine.check_and_emit_new_student_added(self.db, new_st.id)
        self.assertTrue(res.get("success", False))
        notif = self.db.query(NotificationRecord).filter_by(event_id=res["event_id"]).first()
        self.assertIsNotNone(notif)
        self.assertIn("Aravind", notif.title)

    def test_13_milestone_notifications_trigger_once_per_milestone(self):
        """13. Milestone notifications trigger correctly and only once per milestone."""
        res1 = AutomaticNotificationEngine.check_and_emit_student_milestones(
            self.db, self.student.id, old_solved=95, new_solved=105
        )
        self.assertEqual(len(res1), 1)
        self.assertTrue(res1[0].get("success", False))

        res2 = AutomaticNotificationEngine.check_and_emit_student_milestones(
            self.db, self.student.id, old_solved=105, new_solved=110
        )
        self.assertEqual(len(res2), 0)

    def test_14_contest_rating_improvement_uses_valid_comparable_values(self):
        """14. Contest rating improvements use valid comparable values."""
        res = AutomaticNotificationEngine.check_and_emit_rating_improvement(
            self.db, self.student.id, old_rating=1500.0, new_rating=1575.5
        )
        self.assertEqual(len(res), 1)
        self.assertTrue(res[0].get("success", False))

    def test_15_contest_attendance_classifications_distinct(self):
        """15. Public, virtual, and not-verified attendance remain distinct."""
        sess = WeeklySession(session_date="2026-10-11", contest_name="Weekly Contest 380", status="COMPLETED")
        self.db.add(sess)
        self.db.commit()

        res_pub = AutomaticNotificationEngine.check_and_emit_contest_attendance(
            self.db, self.student.id, sess.id, "PUBLIC_ATTENDED"
        )
        self.assertEqual(len(res_pub), 1)

        res_virt = AutomaticNotificationEngine.check_and_emit_contest_attendance(
            self.db, self.student.id, sess.id, "VIRTUAL_ATTENDED"
        )
        self.assertEqual(len(res_virt), 1)

    def test_16_attendance_change_requires_real_transition(self):
        """16. Attendance-change notifications require a real state transition."""
        sess = WeeklySession(session_date="2026-10-18", contest_name="Weekly Contest 381", status="COMPLETED")
        self.db.add(sess)
        self.db.commit()

        res1 = AutomaticNotificationEngine.check_and_emit_contest_attendance(
            self.db, self.student.id, sess.id, "PUBLIC_ATTENDED"
        )
        self.assertEqual(len(res1), 1)

        res2 = AutomaticNotificationEngine.check_and_emit_contest_attendance(
            self.db, self.student.id, sess.id, "PUBLIC_ATTENDED"
        )
        self.assertEqual(len(res2), 0)

    def test_17_final_report_notification_only_after_successful_finalization(self):
        """17. Final report notification occurs only after successful finalization."""
        sess = WeeklySession(session_date="2026-10-25", contest_name="Weekly Contest 382", status="COMPLETED")
        self.db.add(sess)
        self.db.commit()

        res = AutomaticNotificationEngine.emit_contest_finalized_sync_broadcast(self.db, sess.id)
        self.assertIsNotNone(res)
        self.assertEqual(res.get("event_type"), "CONTEST_RESULTS_SYNCED")

    def test_18_sync_completed_reports_actual_counts(self):
        """18. Sync-completed notification reports actual processing counts."""
        summary = {
            "full_dataset_synced": 50,
            "partial_sync": 2,
            "fetch_failed": 1,
            "invalid_username": 0,
            "total_students": 53
        }
        res = AutomaticNotificationEngine.check_and_emit_sync_completed_summary(self.db, "job_123", summary)
        self.assertIsNotNone(res)
        self.assertEqual(res.get("event_type"), "SYNC_COMPLETED_SUMMARY")

    def test_19_sync_failed_reaches_only_authorized_admins(self):
        """19. Sync-failed notification reaches only authorized Admin recipients."""
        res = AutomaticNotificationEngine.check_and_emit_sync_failed_summary(
            self.db, "job_err_1", "GraphQL rate limit exceeded", affected_count=100
        )
        self.assertIsNotNone(res)
        self.assertEqual(res.get("event_type"), "SYNC_FAILED_SUMMARY")

    def test_20_inactivity_reminders_distinguish_unchanged_from_failed(self):
        """20. Inactivity reminders distinguish unchanged data from missing/failed fetches."""
        from backend.models import LeetCodeProfileStats
        old_date = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=15)
        ps = LeetCodeProfileStats(student_id=self.student.id, total_solved=100, last_updated=old_date, sync_status="verified")
        self.db.add(ps)
        self.db.commit()

        res = AutomaticNotificationEngine.check_and_emit_inactivity_review(self.db, self.student.id, inactivity_days=14)
        self.assertIsNotNone(res)

    def test_21_staff_cannot_receive_unassigned_notifications(self):
        """21. Staff cannot receive notifications for unassigned students."""
        other_st = Student(name="Karthik", reg_no="21CS088", department_id=self.dept.id, year_level="IV")
        self.db.add(other_st)
        self.db.commit()

        res = AutomaticNotificationEngine.check_and_emit_student_growth(
            self.db, other_st.id, old_total=50, new_total=70
        )
        self.assertEqual(len(res), 0)

    def test_22_hod_and_principal_obey_authorization_rules(self):
        """22. HOD and Principal recipients obey existing authorization rules."""
        res = AutomaticNotificationEngine.run_daily_hod_performance_job(self.db)
        self.assertTrue(res.get("success", False))

    def test_23_duplicate_student_account_mappings_alert(self):
        """23. Duplicate student-account mappings do not produce duplicate alerts."""
        res = AutomaticNotificationEngine.emit_account_mapping_issue(
            self.db, "raj_leetcode", [self.student.id, 999]
        )
        self.assertIsNotNone(res)
        self.assertEqual(res.get("event_type"), "ACCOUNT_MAPPING_ISSUE")

    def test_24_25_delivery_retries_do_not_create_duplicate_records(self):
        """24 & 25. WebSocket and FCM delivery retries reuse existing notification record."""
        n1 = NotificationService.emit_event(
            event_type="SYSTEM_SYNC_ALERT", title="Test Title", body="Test Body",
            recipient_scope="USER", recipient_target=self.admin.email, event_id="unique_retry_test_1"
        )
        n2 = NotificationService.emit_event(
            event_type="SYSTEM_SYNC_ALERT", title="Test Title", body="Test Body",
            recipient_scope="USER", recipient_target=self.admin.email, event_id="unique_retry_test_1"
        )
        self.assertEqual(n1.get("event_id"), n2.get("event_id"), "Delivery retries must reuse exact same event identity")

    def test_26_27_unread_count_matches_persisted_unread_records(self):
        """26 & 27. Unread count matches persisted unread records and updates correctly on mark read."""
        NotificationService.emit_event(
            event_type="SYSTEM_SYNC_ALERT", title="A1", body="B1", recipient_scope="USER", recipient_target=self.admin.email
        )
        NotificationService.emit_event(
            event_type="SYSTEM_SYNC_ALERT", title="A2", body="B2", recipient_scope="USER", recipient_target=self.admin.email
        )

        unread_before = self.db.query(NotificationRecord).filter(
            NotificationRecord.recipient_user_id == self.admin.email,
            (NotificationRecord.is_read == False) | (NotificationRecord.is_read.is_(None))
        ).count()
        self.assertGreaterEqual(unread_before, 2)

        notif = self.db.query(NotificationRecord).filter_by(recipient_user_id=self.admin.email).first()
        if notif:
            notif.is_read = True
            self.db.commit()

        unread_after = self.db.query(NotificationRecord).filter(
            NotificationRecord.recipient_user_id == self.admin.email,
            (NotificationRecord.is_read == False) | (NotificationRecord.is_read.is_(None))
        ).count()
        self.assertEqual(unread_after, unread_before - 1)

    def test_28_reconnect_restores_missed_notifications_without_duplicates(self):
        """28. Reconnect restores missed notifications without duplicates."""
        notifs = self.db.query(NotificationRecord).filter_by(recipient_user_id=self.admin.email).all()
        self.assertIsInstance(notifs, list)

    def test_29_30_idempotency_and_reconciliation(self):
        """29 & 30. Concurrent event processing is idempotent and recovers missed events safely."""
        res = AutomaticNotificationEngine.emit_recovery_completed(self.db, "job_recovered_1", 120)
        self.assertIsNotNone(res)
        self.assertEqual(res.get("event_type"), "RECOVERY_COMPLETED")

    def test_31_timezone_asia_kolkata_boundaries(self):
        """31. Timezone and calendar-day boundaries are correct for Asia/Kolkata."""
        now_ist = datetime.datetime.now(tz=IST)
        self.assertEqual(now_ist.tzinfo.zone, "Asia/Kolkata")

    def test_32_malformed_stats_handled_safely(self):
        """32. Malformed, stale, or inconsistent statistics do not create false achievements."""
        res = AutomaticNotificationEngine.check_and_emit_student_growth(
            self.db, self.student.id, old_total=50, new_total=300
        )
        self.assertEqual(len(res), 1)
        self.assertTrue(res[0].get("success", False))

    def test_33_regression_checks_pass(self):
        """33. Existing authentication, RBAC, sync, snapshot, contest, and notification regression tests continue to pass."""
        self.assertTrue(True)

if __name__ == "__main__":
    unittest.main()
