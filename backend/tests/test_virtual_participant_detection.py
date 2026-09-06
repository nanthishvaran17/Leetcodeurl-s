"""
test_virtual_participant_detection.py — Master Test Suite for Virtual Contest Detection

Verifies:
Case 1: User participated LIVE -> LIVE, verified = True
Case 2: User participated VIRTUALLY with explicit evidence -> VIRTUAL, verified = True
Case 3: User did not participate -> NONE, verified = True
Case 4: User solved problems post-contest without explicit virtual metadata -> UNKNOWN, verified = False (NOT VIRTUAL!)
Case 5: Contest supports Virtual mode (contestModeAvailable = True), but unverified user stays UNKNOWN
Case 6: User solved 2/4 (solvedCount = 2), but participationMode is strictly independent of solvedCount
"""

import pytest
from backend.services.participation_classifier import (
    ParticipationClassifier, ParticipationType, ConfidenceLevel
)
from backend.services.leetcode_adapter import (
    UserContestResult, UserContestHistoryEntry
)


@pytest.fixture
def classifier():
    return ParticipationClassifier()


@pytest.mark.asyncio
async def test_case_1_live_participant(classifier):
    """Case 1: User participated LIVE."""
    contest_ev = UserContestResult(
        username="john_doe",
        contest_slug="weekly-contest-518",
        source="contest_ranking",
        solved_count=4,
        rank=120
    )
    history_ev = UserContestHistoryEntry(
        contest_slug="weekly-contest-518",
        contest_title="Weekly Contest 518",
        attended=True,
        virtual_contest=False,
        problems_solved=4,
        rank=120
    )

    result = await classifier.classify(
        username="john_doe",
        contest_slug="weekly-contest-518",
        contest_evidence=contest_ev,
        history_evidence=history_ev
    )

    norm = result.to_normalized_dict("john_doe", "John Doe", "weekly-contest-518", "Weekly Contest 518")

    assert norm["participationMode"] == "LIVE"
    assert norm["verified"] is True
    assert norm["solvedCount"] == 4
    assert norm["username"] == "john_doe"


@pytest.mark.asyncio
async def test_case_2_virtual_participant_explicit(classifier):
    """Case 2: User participated VIRTUALLY with explicit metadata."""
    virtual_ev = UserContestResult(
        username="jane_smith",
        contest_slug="weekly-contest-518",
        is_virtual=True,
        solved_count=2,
        source="contest_participation"
    )
    history_ev = UserContestHistoryEntry(
        contest_slug="weekly-contest-518",
        contest_title="Weekly Contest 518",
        attended=False,
        virtual_contest=True,
        problems_solved=2
    )

    result = await classifier.classify(
        username="jane_smith",
        contest_slug="weekly-contest-518",
        virtual_evidence=virtual_ev,
        history_evidence=history_ev
    )

    norm = result.to_normalized_dict("jane_smith", "Jane Smith", "weekly-contest-518", "Weekly Contest 518")

    assert norm["participationMode"] == "VIRTUAL"
    assert norm["verified"] is True
    assert norm["solvedCount"] == 2


@pytest.mark.asyncio
async def test_case_3_non_participant(classifier):
    """Case 3: User did not participate."""
    history_ev = UserContestHistoryEntry(
        contest_slug="weekly-contest-518",
        contest_title="Weekly Contest 518",
        attended=False,
        virtual_contest=False,
        problems_solved=0
    )

    result = await classifier.classify(
        username="absent_user",
        contest_slug="weekly-contest-518",
        history_evidence=history_ev
    )

    norm = result.to_normalized_dict("absent_user", "Absent User", "weekly-contest-518", "Weekly Contest 518")

    assert norm["participationMode"] == "NONE"
    assert norm["verified"] is True
    assert norm["solvedCount"] == 0


@pytest.mark.asyncio
async def test_case_4_post_contest_solves_unverified_mode(classifier):
    """
    Case 4: User solved 2/4 problems after contest, but participation mode
    cannot be determined with explicit virtual metadata.
    Expected: UNKNOWN, verified = False (MUST NOT be VIRTUAL!)
    """
    history_ev = UserContestHistoryEntry(
        contest_slug="weekly-contest-518",
        contest_title="Weekly Contest 518",
        attended=False,
        virtual_contest=False,
        problems_solved=2
    )

    result = await classifier.classify(
        username="late_solver",
        contest_slug="weekly-contest-518",
        history_evidence=history_ev
    )

    norm = result.to_normalized_dict("late_solver", "Late Solver", "weekly-contest-518", "Weekly Contest 518")

    assert norm["participationMode"] == "UNKNOWN"
    assert norm["verified"] is False
    assert norm["solvedCount"] == 2
    assert norm["participationMode"] != "VIRTUAL"


@pytest.mark.asyncio
async def test_case_5_contest_supports_virtual_unverified_stays_unknown(classifier):
    """
    Case 5: Contest itself supports Virtual mode (contestModeAvailable = True).
    Expected: contestModeAvailable = True, but user participationMode remains UNKNOWN until verified.
    """
    result = await classifier.classify(
        username="unknown_mode_user",
        contest_slug="weekly-contest-518"
    )

    norm = result.to_normalized_dict(
        "unknown_mode_user", "Unknown User", "weekly-contest-518", "Weekly Contest 518", contest_mode_available=True
    )

    assert norm["contestModeAvailable"] is True
    assert norm["participationMode"] == "UNKNOWN"
    assert norm["verified"] is False


@pytest.mark.asyncio
async def test_case_6_solved_count_independent_of_mode(classifier):
    """
    Case 6: User solved 2/4 (solvedCount = 2).
    Expected: solvedCount = 2, but participationMode remains independent (UNKNOWN unless verified).
    """
    history_ev = UserContestHistoryEntry(
        contest_slug="weekly-contest-518",
        contest_title="Weekly Contest 518",
        attended=False,
        virtual_contest=False,
        problems_solved=2
    )

    result = await classifier.classify(
        username="independent_solver",
        contest_slug="weekly-contest-518",
        history_evidence=history_ev
    )

    norm = result.to_normalized_dict("independent_solver", "Independent Solver", "weekly-contest-518", "Weekly Contest 518")

    assert norm["solvedCount"] == 2
    assert norm["participationMode"] == "UNKNOWN"
    assert norm["verified"] is False
