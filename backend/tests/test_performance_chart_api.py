import pytest
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_performance_chart_api_schema():
    response = client.get("/api/analytics/performance-chart?timeframe=30d")
    assert response.status_code == 200
    json_data = response.json()
    assert "data" in json_data
    assert "metrics" in json_data
    assert "data_as_of" in json_data
    assert "scope" in json_data
    
    metrics = json_data["metrics"]
    assert "peak_solved" in metrics
    assert "peak_active" in metrics
    assert "most_active_date" in metrics
    assert "period_growth" in metrics

def test_performance_chart_api_timeframes():
    timeframes = ["this_week", "last_week", "this_month", "last_month", "30d", "90d", "academic_year"]
    for tf in timeframes:
        response = client.get(f"/api/analytics/performance-chart?timeframe={tf}")
        assert response.status_code == 200
        assert "data" in response.json()

def test_performance_chart_api_department_filter():
    response = client.get("/api/analytics/performance-chart?department=CSE(CS)")
    assert response.status_code == 200
    json_data = response.json()
    assert json_data["scope"]["department"] == "CSE(CS)"
