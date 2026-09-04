import pytest
from backend.services.participation_classifier import ParticipationClassifier, ParticipationType, ConfidenceLevel
from backend.services.leetcode_adapter import UserContestResult, UserContestHistoryEntry

@pytest.fixture
def classifier():
    return ParticipationClassifier()

@pytest.mark.asyncio
async def test_clear_live_leaderboard(classifier):
    contest_ev = UserContestResult(username="test_user", contest_slug="weekly-contest-400", source="contest_ranking", solved_count=3, rank=100)
    history_ev = UserContestHistoryEntry(contest_slug="weekly-contest-400", contest_title="Weekly Contest 400", attended=True, virtual_contest=False, problems_solved=3, rank=100)
    
    result = await classifier.classify("test_user", "weekly-contest-400", contest_evidence=contest_ev, history_evidence=history_ev)
    
    assert result.participation_type == ParticipationType.LIVE
    assert result.confidence == ConfidenceLevel.VERY_HIGH
    assert "Found in official live contest leaderboard" in result.classification_reason

@pytest.mark.asyncio
async def test_clear_virtual_explicit(classifier):
    virtual_ev = UserContestResult(username="test_user", contest_slug="weekly-contest-400", is_virtual=True, solved_count=2, source="contest_participation")
    history_ev = UserContestHistoryEntry(contest_slug="weekly-contest-400", contest_title="Weekly Contest 400", attended=False, virtual_contest=True, problems_solved=2)
    
    result = await classifier.classify("test_user", "weekly-contest-400", virtual_evidence=virtual_ev, history_evidence=history_ev)
    
    assert result.participation_type == ParticipationType.VIRTUAL
    assert result.confidence == ConfidenceLevel.HIGH

@pytest.mark.asyncio
async def test_clear_not_attended(classifier):
    history_ev = UserContestHistoryEntry(contest_slug="weekly-contest-400", contest_title="Weekly Contest 400", attended=False, virtual_contest=False, problems_solved=0)
    
    result = await classifier.classify("test_user", "weekly-contest-400", history_evidence=history_ev)
    
    assert result.participation_type == ParticipationType.NOT_ATTENDED
    assert result.confidence == ConfidenceLevel.HIGH

@pytest.mark.asyncio
async def test_smart_virtual_inference(classifier):
    # attended=false but solved>0 should be inferred VIRTUAL
    history_ev = UserContestHistoryEntry(contest_slug="weekly-contest-400", contest_title="Weekly Contest 400", attended=False, virtual_contest=False, problems_solved=4)
    
    result = await classifier.classify("test_user", "weekly-contest-400", history_evidence=history_ev)
    
    assert result.participation_type == ParticipationType.VIRTUAL
    assert result.confidence == ConfidenceLevel.MODERATE

@pytest.mark.asyncio
async def test_conflict_resolution_leaderboard_wins(classifier):
    # Leaderboard says LIVE, History implicitly infers VIRTUAL.
    # Leaderboard should override because profile might be delayed/buggy.
    contest_ev = UserContestResult(username="test_user", contest_slug="weekly-contest-400", source="contest_ranking", solved_count=3)
    history_ev = UserContestHistoryEntry(contest_slug="weekly-contest-400", contest_title="Weekly Contest 400", attended=False, virtual_contest=False, problems_solved=3)
    
    result = await classifier.classify("test_user", "weekly-contest-400", contest_evidence=contest_ev, history_evidence=history_ev)
    
    assert result.participation_type == ParticipationType.LIVE
    assert result.confidence == ConfidenceLevel.HIGH

@pytest.mark.asyncio
async def test_conflict_material_disagreement(classifier):
    # Leaderboard says explicitly virtual, Profile says explicitly attended live.
    contest_ev = UserContestResult(username="test_user", contest_slug="weekly-contest-400", source="contest_ranking", is_virtual=True)
    history_ev = UserContestHistoryEntry(contest_slug="weekly-contest-400", contest_title="Weekly Contest 400", attended=True, virtual_contest=False)
    
    result = await classifier.classify("test_user", "weekly-contest-400", contest_evidence=contest_ev, history_evidence=history_ev)
    
    assert result.participation_type == ParticipationType.CONFLICT
    assert result.confidence == ConfidenceLevel.LOW

@pytest.mark.asyncio
async def test_unknown_no_evidence(classifier):
    result = await classifier.classify("test_user", "weekly-contest-400")
    
    assert result.participation_type == ParticipationType.UNKNOWN
    assert result.confidence == ConfidenceLevel.LOW

@pytest.mark.asyncio
async def test_profile_says_live_leaderboard_missing(classifier):
    # Profile updated but Leaderboard query timed out / missing
    history_ev = UserContestHistoryEntry(contest_slug="weekly-contest-400", contest_title="Weekly Contest 400", attended=True, virtual_contest=False, problems_solved=1)
    
    result = await classifier.classify("test_user", "weekly-contest-400", history_evidence=history_ev)
    
    assert result.participation_type == ParticipationType.LIVE
    assert result.confidence == ConfidenceLevel.HIGH

@pytest.mark.asyncio
async def test_leaderboard_live_profile_missing(classifier):
    # Leaderboard updated (Sunday) but Profile hasn't synced (usually takes till Wed)
    contest_ev = UserContestResult(username="test_user", contest_slug="weekly-contest-400", source="contest_ranking", solved_count=2)
    
    result = await classifier.classify("test_user", "weekly-contest-400", contest_evidence=contest_ev)
    
    assert result.participation_type == ParticipationType.LIVE
    assert result.confidence == ConfidenceLevel.HIGH

@pytest.mark.asyncio
async def test_explicit_virtual_only(classifier):
    virtual_ev = UserContestResult(username="test_user", contest_slug="weekly-contest-400", is_virtual=True, source="contest_participation", solved_count=4)
    
    result = await classifier.classify("test_user", "weekly-contest-400", virtual_evidence=virtual_ev)
    
    assert result.participation_type == ParticipationType.VIRTUAL
    assert result.confidence == ConfidenceLevel.HIGH
    assert result.solved_count == 4
