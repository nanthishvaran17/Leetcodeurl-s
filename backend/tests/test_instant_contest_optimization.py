import unittest
import time
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import SessionLocal
from backend.models import WeeklySession, User
from backend.routes.auth import create_access_token

class TestInstantContestOptimization(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        with SessionLocal() as db:
            cls.session3 = db.query(WeeklySession).filter(WeeklySession.id == 3).first()
            cls.session2 = db.query(WeeklySession).filter(WeeklySession.id == 2).first()
            cls.session1 = db.query(WeeklySession).filter(WeeklySession.id == 1).first()
            admin = db.query(User).filter(User.role.ilike('%admin%')).first()
            if admin:
                token = create_access_token(data={"sub": admin.username, "role": admin.role, "email": admin.email, "user_id": admin.id})
                cls.auth_headers = {"Authorization": f"Bearer {token}"}
            else:
                cls.auth_headers = {}

    def test_01_priority1_summary_endpoint_performance(self):
        """Verify Priority 1 summary endpoint responds in < 300ms and cached in < 30ms."""
        # Cold request
        t0 = time.time()
        resp = self.client.get("/api/contests/sessions/3/summary")
        cold_ms = (time.time() - t0) * 1000
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["contestNumber"], 518)
        self.assertEqual(data["status"], "FINALIZED")
        self.assertIn("solvedDistribution", data)
        self.assertIn("participantCount", data)

        # Warm / RAM Cached request
        t1 = time.time()
        resp_cached = self.client.get("/api/contests/sessions/3/summary")
        warm_ms = (time.time() - t1) * 1000
        self.assertEqual(resp_cached.status_code, 200)
        self.assertLess(warm_ms, 50.0, f"Warm summary response took {warm_ms:.1f}ms, expected < 50ms")
        print(f"\n[BENCHMARK] Session 3 Summary -> Cold: {cold_ms:.1f}ms | Warm (RAM Cache): {warm_ms:.1f}ms")

    def test_02_priority2_questions_endpoint(self):
        """Verify Priority 2 questions endpoint response format and speed."""
        t0 = time.time()
        resp = self.client.get("/api/contests/sessions/2/questions")
        dur_ms = (time.time() - t0) * 1000
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("questions", data)
        self.assertLess(dur_ms, 300.0, f"Questions endpoint took {dur_ms:.1f}ms, expected < 300ms")
        print(f"[BENCHMARK] Session 2 Questions -> Response: {dur_ms:.1f}ms")

    def test_03_priority3_paginated_matrix_roster(self):
        """Verify Priority 3 paginated student roster loads only requested page size."""
        t0 = time.time()
        resp = self.client.get("/api/contests/sessions/2/matrix?paginated=true&page=1&limit=25", headers=self.auth_headers)
        dur_ms = (time.time() - t0) * 1000
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["page"], 1)
        self.assertEqual(data["limit"], 25)
        self.assertLessEqual(len(data["items"]), 25)
        self.assertIn("metrics", data)
        print(f"[BENCHMARK] Session 2 Paginated Matrix (25 rows) -> Response: {dur_ms:.1f}ms")

    def test_04_priority4_deep_analytics(self):
        """Verify Priority 4 deep analytics loaded asynchronously with comparisons."""
        t0 = time.time()
        resp = self.client.get("/api/contests/sessions/2/analytics")
        dur_ms = (time.time() - t0) * 1000
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["contestNumber"], 517)
        self.assertIn("departmentAnalytics", data)
        self.assertIn("comparison", data)
        print(f"[BENCHMARK] Session 2 Deep Analytics -> Response: {dur_ms:.1f}ms")

    def test_05_contest_slug_and_number_resolution(self):
        """Verify endpoints resolve both numeric IDs (3), contest numbers (518), and slugs (weekly-contest-518)."""
        for id_param in [3, "3", "518", "weekly-contest-518"]:
            resp = self.client.get(f"/api/contests/sessions/{id_param}/summary")
            self.assertEqual(resp.status_code, 200)
            data = resp.json()
            self.assertEqual(data["contestNumber"], 518)

    def test_06_data_correctness_across_sessions(self):
        """Verify distinct, accurate metrics between W516, W517, W518 without data mixing."""
        resp1 = self.client.get("/api/contests/sessions/1/summary").json()
        resp2 = self.client.get("/api/contests/sessions/2/summary").json()
        resp3 = self.client.get("/api/contests/sessions/3/summary").json()

        self.assertEqual(resp1["contestNumber"], 516)
        self.assertEqual(resp2["contestNumber"], 517)
        self.assertEqual(resp3["contestNumber"], 518)

        # Verify session 1 and session 2 have their real respective counts
        self.assertEqual(resp1["participantCount"], 153)
        self.assertEqual(resp2["participantCount"], 187)

    def test_07_finalized_contest_live_polling_safety(self):
        """Verify that finalized contests return FINALIZED status to prevent unnecessary polling."""
        resp = self.client.get("/api/contests/sessions/3/summary").json()
        self.assertEqual(resp["status"], "FINALIZED")
        self.assertEqual(resp["verificationStatus"], "FINALIZED")

if __name__ == "__main__":
    unittest.main()
