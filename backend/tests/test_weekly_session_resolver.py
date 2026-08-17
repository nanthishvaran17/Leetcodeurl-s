"""
Unit tests for weekly_session_resolver.py
Covers: 0 sessions, 1 session, 2+ sessions, CLI overrides, and regex extraction.
"""
import unittest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.database import Base
from backend.models import WeeklySession
from backend.services.weekly_session_resolver import (
    resolve_weekly_sessions,
    extract_contest_number
)


class TestWeeklySessionResolver(unittest.TestCase):

    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(bind=self.engine)
        Session = sessionmaker(bind=self.engine)
        self.db = Session()

    def tearDown(self):
        self.db.close()

    def test_extract_contest_number_various_formats(self):
        """Tests extraction from various string formats, integers, and session objects."""
        self.assertEqual(extract_contest_number(None), None)
        self.assertEqual(extract_contest_number(515), 515)
        self.assertEqual(extract_contest_number("Weekly Contest 515"), 515)
        self.assertEqual(extract_contest_number("weekly-contest-514"), 514)
        self.assertEqual(extract_contest_number("Contest 470"), 470)

        s = WeeklySession(id=1, week_number=1, contest_name="Weekly Contest 512", session_date="26.07.2026", status="FINALIZED")
        self.assertEqual(extract_contest_number(s), 512)

    def test_case1_zero_sessions(self):
        """When DB has 0 sessions, both should be None and mode='insufficient'."""
        res = resolve_weekly_sessions(self.db)
        self.assertIsNone(res["current_week_session"])
        self.assertIsNone(res["last_week_session"])
        self.assertIsNone(res["current_week_contest"])
        self.assertIsNone(res["last_week_contest"])
        self.assertEqual(res["resolution_mode"], "insufficient")

    def test_case2_one_session(self):
        """When DB has 1 finalized session, current is resolved, last is None, mode='db_auto'."""
        s = WeeklySession(id=1, week_number=1, contest_name="Weekly Contest 515", session_date="16.08.2026", status="FINALIZED")
        self.db.add(s)
        self.db.commit()

        res = resolve_weekly_sessions(self.db)
        self.assertIsNotNone(res["current_week_session"])
        self.assertEqual(res["current_week_contest"], 515)
        self.assertIsNone(res["last_week_session"])
        self.assertIsNone(res["last_week_contest"])
        self.assertEqual(res["resolution_mode"], "db_auto")

    def test_case3_two_plus_sessions(self):
        """When DB has 2+ finalized sessions, current is largest contest number, last is second largest."""
        s510 = WeeklySession(id=1, week_number=1, contest_name="Weekly Contest 510", session_date="12.07.2026", status="FINALIZED")
        s514 = WeeklySession(id=2, week_number=2, contest_name="Weekly Contest 514", session_date="09.08.2026", status="FINALIZED")
        s515 = WeeklySession(id=3, week_number=3, contest_name="Weekly Contest 515", session_date="16.08.2026", status="FINALIZED")
        s_live = WeeklySession(id=4, week_number=4, contest_name="Weekly Contest 516", session_date="23.08.2026", status="LIVE")
        self.db.add_all([s510, s514, s515, s_live])
        self.db.commit()

        res = resolve_weekly_sessions(self.db)
        self.assertEqual(res["current_week_contest"], 515)
        self.assertEqual(res["last_week_contest"], 514)
        self.assertEqual(res["resolution_mode"], "db_auto")
        self.assertEqual(res["current_week_session"].id, 3)
        self.assertEqual(res["last_week_session"].id, 2)

    def test_case4_cli_override(self):
        """CLI overrides resolve explicit contests from DB."""
        s513 = WeeklySession(id=1, week_number=1, contest_name="Weekly Contest 513", session_date="02.08.2026", status="FINALIZED")
        s514 = WeeklySession(id=2, week_number=2, contest_name="Weekly Contest 514", session_date="09.08.2026", status="FINALIZED")
        s515 = WeeklySession(id=3, week_number=3, contest_name="Weekly Contest 515", session_date="16.08.2026", status="FINALIZED")
        self.db.add_all([s513, s514, s515])
        self.db.commit()

        res = resolve_weekly_sessions(self.db, last_week=513, current_week=514)
        self.assertEqual(res["current_week_contest"], 514)
        self.assertEqual(res["last_week_contest"], 513)
        self.assertEqual(res["resolution_mode"], "cli_override")
        self.assertEqual(res["current_week_session"].id, 2)
        self.assertEqual(res["last_week_session"].id, 1)


if __name__ == "__main__":
    unittest.main()
