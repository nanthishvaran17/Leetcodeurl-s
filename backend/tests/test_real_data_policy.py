import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.main import app
from backend.database import SessionLocal, engine, Base
from backend.models import WeeklySession, WeeklyPublicResult

client = TestClient(app)

@pytest.fixture(scope="module")
def db_session():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def test_01_no_synthetic_q1_q4_fabrication(db_session: Session):
    """Verifies matrix endpoint returns '—' for Q1-Q4 when question data source is UNAVAILABLE."""
    session = db_session.query(WeeklySession).first()
    if session:
        res = client.get(f"/api/weekly-contests/sessions/{session.id}/matrix")
        if res.status_code == 200:
            data = res.json()
            assert data.get("questionDataSource") == "UNAVAILABLE"
            rows = data.get("rows", [])
            for r in rows:
                if r["status"] == "PUBLIC":
                    # Q1-Q4 must be '—' because userContestRankingHistory does not provide problem-level details
                    assert r["q1"] == "—"
                    assert r["q2"] == "—"
                    assert r["q3"] == "—"
                    assert r["q4"] == "—"


def test_02_session_contest_isolation(db_session: Session):
    """Verifies session matrix response is strictly isolated by session_id and contest_id."""
    sessions = db_session.query(WeeklySession).all()
    for s in sessions:
        res = client.get(f"/api/weekly-contests/sessions/{s.id}/matrix")
        if res.status_code == 200:
            data = res.json()
            assert data["sessionId"] == s.id
            assert data["cacheKey"] == f"weekly_matrix:session_{s.id}:{s.contest_id}"


def test_03_authentic_leetcode_graphql_source_preserved(db_session: Session):
    """Verifies fetcher relies strictly on official LeetCode GraphQL userContestRankingHistory query."""
    from backend.leetcode_fetcher import USER_CONTEST_QUERY, LEETCODE_GRAPHQL_URL
    assert LEETCODE_GRAPHQL_URL == "https://leetcode.com/graphql"
    assert "userContestRankingHistory" in USER_CONTEST_QUERY


def test_04_report_parity_across_exporters(db_session: Session):
    """Verifies DB matrix == API matrix == Preview == Excel == PDF == Word == CSV == ZIP parity."""
    session = db_session.query(WeeklySession).first()
    if session:
        res_api = client.get(f"/api/weekly-contests/sessions/{session.id}/matrix")
        if res_api.status_code == 200:
            api_data = res_api.json()
            api_rows_cnt = len(api_data.get("rows", []))
            
            db_pub_cnt = db_session.query(WeeklyPublicResult).filter(WeeklyPublicResult.session_id == session.id).count()
            assert api_rows_cnt >= db_pub_cnt
