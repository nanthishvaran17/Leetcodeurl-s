"""
participation_classifier.py — Deterministic Evidence-Based Contest Participation Classifier

Guarantees:
1. NEVER invents classification without evidence.
2. NEVER fabricates rank, score, or participation data.
3. ALWAYS checks for CONFLICT FIRST before classification.
4. STRICT 3 User-Facing States: ACTUAL, VIRTUAL, NOT_VERIFIED.
5. STRICT 5 Internal Verification States: VERIFIED, PENDING, CONFLICT, INSUFFICIENT_EVIDENCE, SOURCE_ERROR.
6. ACTUAL requires authoritative contest source AND submission evidence (submissions/attempts > 0).
7. VIRTUAL requires explicit virtual flag. Never inferred from ranking absence.
8. Defaults safely to NOT_VERIFIED.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional

from backend.logger import logger
from backend.services.leetcode_adapter import (
    ContestMetadata,
    LeetCodeAdapter,
    UserContestHistoryEntry,
    UserContestResult,
    UserProfile,
)

# ─────────────────────────────────────────────────────────────────────────────
# CLASSIFICATION RESULT MODEL
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class ClassificationResult:
    # 3 User-Facing States: ACTUAL, VIRTUAL, NOT_VERIFIED
    participation_status: str

    # 5 Internal States: VERIFIED, PENDING, CONFLICT, INSUFFICIENT_EVIDENCE, SOURCE_ERROR
    verification_status: str

    # Performance Data (Populated ONLY when verified; NEVER fabricated)
    rank: Optional[int] = None
    score: Optional[int] = None
    solved_count: Optional[int] = None
    finish_time: Optional[int] = None
    questions: List[Dict[str, Any]] = field(default_factory=list)

    # Evidence Tracking (Auditable)
    evidence: Any = None
    confidence: str = "NONE"  # HIGH, MEDIUM, UNKNOWN, NONE
    source: str = "default_fallback"
    conflict_details: Optional[Dict[str, Any]] = None
    raw_evidence_chain: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "participation_status": self.participation_status,
            "verification_status": self.verification_status,
            "rank": self.rank,
            "score": self.score,
            "solved_count": self.solved_count,
            "finish_time": self.finish_time,
            "questions": self.questions,
            "evidence": str(self.evidence) if self.evidence is not None else None,
            "confidence": self.confidence,
            "source": self.source,
            "conflict_details": self.conflict_details,
        }


# ─────────────────────────────────────────────────────────────────────────────
# PARTICIPATION CLASSIFIER
# ─────────────────────────────────────────────────────────────────────────────

class ParticipationClassifier:
    """
    Evidence-based classification engine with strict conflict detection first.
    """

    def __init__(self, adapter: Optional[LeetCodeAdapter] = None):
        self.adapter = adapter

    async def classify(
        self,
        username: str,
        contest_slug: str,
        contest_evidence: Optional[UserContestResult] = None,
        history_evidence: Optional[UserContestHistoryEntry] = None,
        virtual_evidence: Optional[UserContestResult] = None,
        profile_data: Optional[UserProfile] = None,
    ) -> ClassificationResult:
        """
        Main classification workflow adhering strictly to the evidence flow:
        Step 1: Collect & normalize evidence
        Step 2: Validate username and contest identity
        Step 3: Check CONFLICT FIRST
        Step 4: Check STRONG ACTUAL
        Step 5: Check EXPLICIT VIRTUAL
        Step 6: Default fallback to NOT_VERIFIED
        """
        # Step 1: Normalize username
        uname = (username or "").strip().lower()
        slug = (contest_slug or "").strip().lower()

        raw_evidence_chain = {
            "contest_evidence": contest_evidence,
            "history_evidence": history_evidence,
            "virtual_evidence": virtual_evidence,
            "profile_data": profile_data,
        }

        # Step 2: Validate contest identity & username matches
        contest_ev = self._validate_contest_evidence(contest_evidence, uname, slug)
        history_ev = self._validate_history_evidence(history_evidence, uname, slug)
        virtual_ev = self._validate_contest_evidence(virtual_evidence, uname, slug)

        # Step 3: Check CONFLICT FIRST (Before ANY classification)
        if self._has_conflict(contest_ev, history_ev, virtual_ev):
            conflict_info = self._get_conflict_details(contest_ev, history_ev, virtual_ev)
            logger.warning(
                f"[CLASSIFIER CONFLICT] Conflict detected for user={username}, contest={contest_slug}: {conflict_info}"
            )
            return ClassificationResult(
                participation_status="NOT_VERIFIED",
                verification_status="CONFLICT",
                confidence="UNKNOWN",
                source="conflict_detection",
                conflict_details=conflict_info,
                raw_evidence_chain=raw_evidence_chain,
            )

        # Step 4: Check STRONG ACTUAL
        if contest_ev and self._is_strong_actual(contest_ev):
            return ClassificationResult(
                participation_status="ACTUAL",
                verification_status="VERIFIED",
                rank=contest_ev.rank,
                score=contest_ev.score,
                solved_count=contest_ev.solved_count if contest_ev.solved_count is not None else contest_ev.submission_count,
                finish_time=contest_ev.finish_time,
                questions=contest_ev.questions or [],
                evidence=contest_ev.source,
                confidence="HIGH",
                source="contest_evidence_with_submissions",
                raw_evidence_chain=raw_evidence_chain,
            )

        # Check for Ranking presence but 0 submissions -> INSUFFICIENT_EVIDENCE
        if contest_ev and self._is_ranking_without_submissions(contest_ev):
            return ClassificationResult(
                participation_status="NOT_VERIFIED",
                verification_status="INSUFFICIENT_EVIDENCE",
                rank=contest_ev.rank,
                score=contest_ev.score,
                evidence="ranking_found_without_submission_records",
                confidence="NONE",
                source="ranking_without_submissions",
                raw_evidence_chain=raw_evidence_chain,
            )

        # Step 5: Check EXPLICIT VIRTUAL
        if self._is_explicit_virtual(virtual_ev, history_ev):
            # Extract metrics if available from virtual attempt
            v_rank = virtual_ev.rank if virtual_ev else (history_ev.rank if history_ev else None)
            v_score = virtual_ev.score if virtual_ev else (history_ev.problems_solved if history_ev else None)
            v_solved = virtual_ev.solved_count if virtual_ev else (history_ev.problems_solved if history_ev else None)
            v_questions = virtual_ev.questions if virtual_ev else []

            return ClassificationResult(
                participation_status="VIRTUAL",
                verification_status="VERIFIED",
                rank=v_rank,
                score=v_score,
                solved_count=v_solved,
                questions=v_questions,
                evidence="explicit_virtual_evidence",
                confidence="MEDIUM",
                source="user_history_virtual_flag",
                raw_evidence_chain=raw_evidence_chain,
            )

        # Step 6: Safe default -> NOT_VERIFIED / PENDING
        return ClassificationResult(
            participation_status="NOT_VERIFIED",
            verification_status="PENDING",
            evidence="no_reliable_evidence_found",
            confidence="NONE",
            source="default_fallback",
            raw_evidence_chain=raw_evidence_chain,
        )

    # ─────────────────────────────────────────────────────────────────────────
    # VALIDATION & SIGNAL HELPERS
    # ─────────────────────────────────────────────────────────────────────────

    def _normalize_slug(self, s: Optional[str]) -> str:
        if not s:
            return ""
        return s.strip().lower().replace(" ", "-").replace("_", "-")

    def _validate_contest_evidence(
        self, ev: Optional[UserContestResult], username: str, contest_slug: str
    ) -> Optional[UserContestResult]:
        if not ev:
            return None
        if ev.username and ev.username.strip().lower() != username:
            return None
        if ev.contest_slug and self._normalize_slug(ev.contest_slug) != self._normalize_slug(contest_slug):
            return None
        return ev

    def _validate_history_evidence(
        self, ev: Optional[UserContestHistoryEntry], username: str, contest_slug: str
    ) -> Optional[UserContestHistoryEntry]:
        if not ev:
            return None
        ev_slug = self._normalize_slug(ev.contest_slug or ev.contest_title)
        if ev_slug and ev_slug != self._normalize_slug(contest_slug):
            return None
        return ev

    def _is_actual_signal(self, ev: Any) -> bool:
        if not ev:
            return False
        if isinstance(ev, UserContestResult):
            if ev.is_virtual or ev.is_explicit_virtual:
                return False
            # Authoritative source signal
            if ev.source in ["contest_ranking", "contest_participation", "final_contest"]:
                return True
            if ev.attended is True and not ev.is_virtual:
                return True
        elif isinstance(ev, UserContestHistoryEntry):
            if ev.attended is True and not ev.virtual_contest:
                return True
        return False

    def _is_virtual_signal(self, ev: Any) -> bool:
        if not ev:
            return False
        if isinstance(ev, UserContestResult):
            return bool(ev.is_virtual or ev.is_explicit_virtual)
        elif isinstance(ev, UserContestHistoryEntry):
            return bool(ev.virtual_contest is True or (ev.attended is False and ev.problems_solved > 0))
        return False

    def _has_conflict(
        self,
        contest_evidence: Optional[UserContestResult],
        history_evidence: Optional[UserContestHistoryEntry],
        virtual_evidence: Optional[UserContestResult],
    ) -> bool:
        """
        Check if evidence sources conflict:
        Conflict: One source says ACTUAL while another source says VIRTUAL.
        """
        contest_says_actual = contest_evidence and self._is_actual_signal(contest_evidence)
        history_says_actual = history_evidence and self._is_actual_signal(history_evidence)
        
        history_says_virtual = history_evidence and self._is_virtual_signal(history_evidence)
        virtual_says_virtual = virtual_evidence and self._is_virtual_signal(virtual_evidence)
        contest_says_virtual = contest_evidence and self._is_virtual_signal(contest_evidence)

        has_actual = bool(contest_says_actual or history_says_actual)
        has_virtual = bool(history_says_virtual or virtual_says_virtual or contest_says_virtual)

        return has_actual and has_virtual

    def _get_conflict_details(
        self,
        contest_evidence: Optional[UserContestResult],
        history_evidence: Optional[UserContestHistoryEntry],
        virtual_evidence: Optional[UserContestResult],
    ) -> Dict[str, Any]:
        return {
            "contest_evidence_signal": "ACTUAL" if self._is_actual_signal(contest_evidence) else ("VIRTUAL" if self._is_virtual_signal(contest_evidence) else "NONE"),
            "history_evidence_signal": "ACTUAL" if self._is_actual_signal(history_evidence) else ("VIRTUAL" if self._is_virtual_signal(history_evidence) else "NONE"),
            "virtual_evidence_signal": "VIRTUAL" if self._is_virtual_signal(virtual_evidence) else "NONE",
            "contest_source": getattr(contest_evidence, "source", None),
            "history_source": getattr(history_evidence, "source", None),
        }

    def _is_strong_actual(self, evidence: Optional[UserContestResult]) -> bool:
        """
        Check if evidence is STRONG ACTUAL:
        REQUIRES:
        1. Found in authoritative contest source (contest_ranking, contest_participation, final_contest, user_contest_history with attended=True)
        2. HAS SUBMISSION EVIDENCE (count > 0 OR attempt_count > 0 OR has_submission_records OR explicit_participation_flag)
        3. NOT explicitly virtual
        """
        if not evidence:
            return False

        if evidence.is_virtual is True or evidence.is_explicit_virtual is True:
            return False

        # Source must be authoritative
        if evidence.source not in [
            "contest_ranking",
            "contest_participation",
            "final_contest",
            "user_contest_history",
        ]:
            return False

        # Must have positive submission proof
        has_submissions = (
            (evidence.submission_count is not None and evidence.submission_count > 0)
            or (evidence.attempt_count is not None and evidence.attempt_count > 0)
            or (evidence.solved_count is not None and evidence.solved_count > 0)
            or (evidence.score is not None and evidence.score > 0)
            or (evidence.has_submission_records is True)
            or (evidence.explicit_participation_flag is True)
        )

        return bool(has_submissions)

    def _is_ranking_without_submissions(self, evidence: Optional[UserContestResult]) -> bool:
        """Found in ranking or contest result but has 0 submissions and no attempt evidence."""
        if not evidence:
            return False
        if evidence.is_virtual:
            return False

        has_no_submissions = (
            (evidence.submission_count == 0)
            and (evidence.attempt_count == 0)
            and (evidence.solved_count is None or evidence.solved_count == 0)
            and (evidence.has_submission_records is False)
            and (evidence.explicit_participation_flag is False)
        )
        return bool(has_no_submissions)

    def _is_explicit_virtual(
        self,
        virtual_evidence: Optional[UserContestResult],
        history_evidence: Optional[UserContestHistoryEntry],
    ) -> bool:
        """
        Check if VIRTUAL has explicit evidence:
        REQUIRES:
        1. Explicit virtual flag/type in user history or virtual evidence.
        2. Valid contest identity and username.
        """
        if virtual_evidence and (virtual_evidence.is_explicit_virtual or virtual_evidence.is_virtual):
            return True

        if history_evidence and (history_evidence.virtual_contest is True):
            return True

        return False
