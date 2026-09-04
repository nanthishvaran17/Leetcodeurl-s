import pytest
import httpx
from backend.services.contest_classifier import (
    get_contest_status,
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
    assert result.status == ContestStatus.PENDING_VERIFICATION
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
    async def mock_fetch(*args, **kwargs):
        return "ok", {"attended": True, "problems_solved": 4}
        
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
    assert result.status == ContestStatus.PUBLIC_LIVE
    assert result.reason_code == ReasonCode.VALID_LIVE_SUBMISSION

@pytest.mark.asyncio
async def test_explicit_virtual(monkeypatch):
    async def mock_validate(*args, **kwargs):
        return "ok", "testuser"
    async def mock_fetch(*args, **kwargs):
        return "ok", {"attended": False, "is_virtual": True, "problems_solved": 2}
        
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
    assert result.status == ContestStatus.VIRTUAL_PRACTICE
    assert result.reason_code == ReasonCode.EXPLICIT_VIRTUAL

@pytest.mark.asyncio
async def test_late_practice(monkeypatch):
    async def mock_validate(*args, **kwargs):
        return "ok", "testuser"
    async def mock_fetch(*args, **kwargs):
        return "ok", {"attended": False, "is_virtual": False, "problems_solved": 2}
        
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
