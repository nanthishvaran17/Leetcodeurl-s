from backend.cache import cache


def test_leaderboard_fast_empty_returns_json_bytes(client):
    cache.clear()
    response = client.get("/api/students/leaderboard-fast?dept_id=-1")
    assert response.status_code == 200
    assert response.json() == []
