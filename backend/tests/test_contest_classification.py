import pytest
import httpx
import datetime
from backend.services.contest_classifier import (
    get_contest_status,
    get_contest_utc_window,
    ContestStatus,
    ReasonCode
)

@pytest.mark.asyncio
async def test_no_handle():
    result = await get_contest_status(
        student_id=1,
        student_name="Test Student",
        leetcode_username=None,
        contest_id="weekly-contest-123",
        contest_name="Weekly 123",
        client=httpx.AsyncClient()
    )
    assert result.status == ContestStatus.NO_LEETCODE_HANDLE
    assert result.reason_code == ReasonCode.NO_USERNAME

@pytest.mark.asyncio
async def test_api_failure(monkeypatch):
    async def mock_validate(*args, **kwargs):
        return "timeout", None
    
    import backend.services.contest_classifier as cc
    monkeypatch.setattr(cc, "_validate_leetcode_profile", mock_validate)
    
    result = await get_contest_status(
        student_id=1,
        student_name="Test Student",
        leetcode_username="testuser",
        contest_id="weekly-contest-123",
        contest_name="Weekly 123",
        client=httpx.AsyncClient()
    )
    assert result.status == ContestStatus.NOT_VERIFIED
    assert result.reason_code == ReasonCode.FETCH_ERROR

@pytest.mark.asyncio
async def test_no_entry(monkeypatch):
    async def mock_validate(*args, **kwargs):
        return "ok", "testuser"
    async def mock_fetch(*args, **kwargs):
        return "not_in_history", None
        
    import backend.services.contest_classifier as cc
    monkeypatch.setattr(cc, "_validate_leetcode_profile", mock_validate)
    monkeypatch.setattr(cc, "_fetch_contest_entry", mock_fetch)
    
    result = await get_contest_status(
        student_id=1,
        student_name="Test Student",
        leetcode_username="testuser",
        contest_id="weekly-contest-123",
        contest_name="Weekly 123",
        client=httpx.AsyncClient()
    )
    assert result.status == ContestStatus.NOT_ATTENDED
    assert result.reason_code == ReasonCode.NO_PARTICIPATION

@pytest.mark.asyncio
async def test_public_live(monkeypatch):
    async def mock_validate(*args, **kwargs):
        return "ok", "testuser"

    start_utc, end_utc = get_contest_utc_window("weekly-contest-520")
    sub_ts = int(start_utc.timestamp()) + 600

    async def mock_fetch(*args, **kwargs):
        return "ok", {
            "attended": True,
            "problems_solved": 1,
            "recent_ac": [
                {"id": "1", "title": "Problem A", "titleSlug": "problem-a", "timestamp": sub_ts, "status": "Accepted"}
            ]
        }
        
    import backend.services.contest_classifier as cc
    monkeypatch.setattr(cc, "_validate_leetcode_profile", mock_validate)
    monkeypatch.setattr(cc, "_fetch_contest_entry", mock_fetch)
    
    result = await get_contest_status(
        student_id=1,
        student_name="Test Student",
        leetcode_username="testuser",
        contest_id="weekly-contest-520",
        contest_name="Weekly 520",
        client=httpx.AsyncClient(),
        official_problems=[{"question_order": 1, "title": "Problem A", "titleSlug": "problem-a"}]
    )
    assert result.status in (ContestStatus.LIVE, ContestStatus.PUBLIC_LIVE, ContestStatus.PUBLIC_ATTENDED)
    assert result.reason_code == ReasonCode.VALID_LIVE_SUBMISSION
    assert result.classification_signal == "in_window_submission"

@pytest.mark.asyncio
async def test_explicit_virtual(monkeypatch):
    async def mock_validate(*args, **kwargs):
        return "ok", "testuser"

    start_utc, end_utc = get_contest_utc_window("weekly-contest-520")
    sub_ts = int(end_utc.timestamp()) + 1800 # post contest

    async def mock_fetch(*args, **kwargs):
        return "ok", {
            "attended": False,
            "is_virtual": True,
            "problems_solved": 1,
            "recent_ac": [
                {"id": "2", "title": "Problem A", "titleSlug": "problem-a", "timestamp": sub_ts, "status": "Accepted"}
            ]
        }
        
    import backend.services.contest_classifier as cc
    monkeypatch.setattr(cc, "_validate_leetcode_profile", mock_validate)
    monkeypatch.setattr(cc, "_fetch_contest_entry", mock_fetch)
    
    result = await get_contest_status(
        student_id=1,
        student_name="Test Student",
        leetcode_username="testuser",
        contest_id="weekly-contest-520",
        contest_name="Weekly 520",
        client=httpx.AsyncClient(),
        official_problems=[{"question_order": 1, "title": "Problem A", "titleSlug": "problem-a"}]
    )
    assert result.status in (ContestStatus.VIRTUAL, ContestStatus.VIRTUAL_PRACTICE, ContestStatus.VIRTUAL_ATTENDED)
    assert result.reason_code == ReasonCode.EXPLICIT_VIRTUAL
    assert result.classification_signal == "post_window_only"

@pytest.mark.asyncio
async def test_late_practice(monkeypatch):
    async def mock_validate(*args, **kwargs):
        return "ok", "testuser"
    async def mock_fetch(*args, **kwargs):
        return "ok", {"attended": False, "is_virtual": False, "problems_solved": 0, "recent_ac": []}
        
    import backend.services.contest_classifier as cc
    monkeypatch.setattr(cc, "_validate_leetcode_profile", mock_validate)
    monkeypatch.setattr(cc, "_fetch_contest_entry", mock_fetch)
    
    result = await get_contest_status(
        student_id=1,
        student_name="Test Student",
        leetcode_username="testuser",
        contest_id="weekly-contest-520",
        contest_name="Weekly 520",
        client=httpx.AsyncClient()
    )
    assert result.status == ContestStatus.NOT_ATTENDED
    assert result.reason_code == ReasonCode.NO_PARTICIPATION
