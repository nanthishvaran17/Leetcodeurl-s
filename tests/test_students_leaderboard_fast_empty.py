from backend.cache import cache


def test_leaderboard_fast_returns_empty_list_without_error(client):
    cache.clear()

    response = client.get("/api/students/leaderboard-fast", params={"dept_id": -1})

    assert response.status_code == 200
    assert response.json() == []
