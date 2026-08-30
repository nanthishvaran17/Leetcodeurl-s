"""
participation_classifier.py — Evidence-Based Contest Participation Classification Engine

Guarantees:
1. NEVER claims 100% certainty; prioritizes transparent confidence scoring based on LeetCode evidence.
2. STRICT 5 User-Facing States: LIVE, VIRTUAL, NOT_ATTENDED, UNKNOWN, CONFLICT.
3. Incorporates multi-tier evidence models (Leaderboard, Profile History, Explicit Virtual, Inferences).
4. Handles conflict resolution when strong evidence sources materially disagree.
5. Returns full evidence traces for UI/Staff auditability.
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
# CONSTANTS & ENUMS
# ─────────────────────────────────────────────────────────────────────────────

class ParticipationType:
    LIVE = "LIVE"
    VIRTUAL = "VIRTUAL"
    NOT_ATTENDED = "NOT_ATTENDED"
    UNKNOWN = "UNKNOWN"
    CONFLICT = "CONFLICT"

class ConfidenceLevel:
    VERY_HIGH = "VERY_HIGH"
    HIGH = "HIGH"
    MODERATE = "MODERATE"
    LOW = "LOW"
    NONE = "NONE"


# ─────────────────────────────────────────────────────────────────────────────
# CLASSIFICATION RESULT MODEL
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class ClassificationResult:
    # 5 User-Facing States
    participation_type: str
    
    # Confidence Scoring
    confidence: str
    
    # Human readable reason
    classification_reason: str
    
    # Evidence Trace Summary
    evidence_summary: List[str] = field(default_factory=list)

    # Performance Data
    rank: Optional[int] = None
    score: Optional[int] = None
    solved_count: Optional[int] = None
    finish_time: Optional[int] = None
    questions: List[Dict[str, Any]] = field(default_factory=list)

    raw_evidence_chain: Dict[str, Any] = field(default_factory=dict)
    
    # System metadata
    reconciled_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())

    # ── Backward-compat property aliases (tests & legacy callers) ──────────────

    @property
    def participation_status(self) -> str:
        """Legacy alias: maps current participation_type to older vocabulary.

        LIVE      → 'ACTUAL'   (legacy name for live attendance)
        VIRTUAL   → 'VIRTUAL'
        CONFLICT  → 'NOT_VERIFIED'
        UNKNOWN   → 'NOT_VERIFIED'
        NOT_ATTENDED → 'NOT_VERIFIED'
        """
        _map = {
            "LIVE": "ACTUAL",
            "VIRTUAL": "VIRTUAL",
            "CONFLICT": "NOT_VERIFIED",
            "UNKNOWN": "NOT_VERIFIED",
            "NOT_ATTENDED": "NOT_VERIFIED",
        }
        return _map.get(self.participation_type, self.participation_type)

    @participation_status.setter
    def participation_status(self, value: str) -> None:
        """Allow tests that do `result.participation_status = ...` to set the type."""
        _reverse = {
            "ACTUAL": "LIVE",
            "LIVE": "LIVE",
            "VIRTUAL": "VIRTUAL",
            "NOT_VERIFIED": "UNKNOWN",
            "CONFLICT": "CONFLICT",
        }
        self.participation_type = _reverse.get(value, value)

    @property
    def verification_status(self) -> str:
        """Legacy computed field. Maps confidence + type to a verification verdict."""
        pt = self.participation_type
        conf = self.confidence
        if pt == "CONFLICT":
            return "CONFLICT"
        if pt == "UNKNOWN":
            # No evidence found — legacy tests expect PENDING
            return "PENDING"
        if conf in ("VERY_HIGH", "HIGH"):
            return "VERIFIED"
        if conf == "NONE":
            return "PENDING"
        if conf in ("MODERATE",):
            return "PARTIALLY_VERIFIED"
        # LOW confidence or edge cases (attended=false, score=0, etc.)
        return "INSUFFICIENT_EVIDENCE"

    @property
    def conflict_details(self) -> Optional[List[str]]:
        """Legacy alias for evidence_summary when a conflict exists."""
        if self.participation_type == "CONFLICT":
            return self.evidence_summary or ["Conflict detected between evidence sources."]
        return None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "participation_type": self.participation_type,
            "participation_status": self.participation_status,   # backward compat
            "verification_status": self.verification_status,     # backward compat
            "confidence": self.confidence,
            "classification_reason": self.classification_reason,
            "evidence_summary": self.evidence_summary,
            "rank": self.rank,
            "score": self.score,
            "solved_count": self.solved_count,
            "finish_time": self.finish_time,
            "questions": self.questions,
            "reconciled_at": self.reconciled_at,
        }




# ─────────────────────────────────────────────────────────────────────────────
# PARTICIPATION CLASSIFIER ENGINE
# ─────────────────────────────────────────────────────────────────────────────

class ParticipationClassifier:
    """
    Evidence-based classification engine for LeetCode contest participation.
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
        Main classification workflow adhering strictly to the multi-tier evidence flow.
        """
        uname = (username or "").strip().lower()
        slug = (contest_slug or "").strip().lower()

        raw_chain = {
            "contest_evidence": contest_evidence,
            "history_evidence": history_evidence,
            "virtual_evidence": virtual_evidence,
            "profile_data": profile_data,
        }

        # Validate Identity & Contest Context
        c_ev = self._validate_contest_evidence(contest_evidence, uname, slug)
        h_ev = self._validate_history_evidence(history_evidence, uname, slug)
        v_ev = self._validate_contest_evidence(virtual_evidence, uname, slug)

        evidence_trace = []
        
        # Determine base signals
        c_is_live, c_live_proof = self._is_live_signal(c_ev, "Leaderboard")
        h_is_live, h_live_proof = self._is_live_signal(h_ev, "Profile History")
        
        c_is_virtual, c_virt_proof = self._is_virtual_signal(c_ev, "Leaderboard")
        h_is_virtual, h_virt_proof = self._is_virtual_signal(h_ev, "Profile History")
        v_is_virtual, v_virt_proof = self._is_virtual_signal(v_ev, "Explicit Virtual Source")
        
        has_live_signal = c_is_live or h_is_live
        has_virtual_signal = c_is_virtual or h_is_virtual or v_is_virtual

        # 1. CONFLICT DETECTION
        if has_live_signal and has_virtual_signal:
            # Handle minor false conflicts (e.g., Profile says Not Attended + Solved > 0, but Leaderboard says LIVE)
            # If Leaderboard explicitly says LIVE, and history says VIRTUAL implicitly (attended=False, solved>0), Leaderboard wins.
            if c_is_live and h_is_virtual and getattr(h_ev, "attended", None) is False:
                evidence_trace.append("RESOLVED CONFLICT: Official leaderboard LIVE overrides profile implicit virtual inference.")
                pass # Continue to LIVE resolution
            else:
                evidence_trace.append(f"CONFLICT DETECTED: Sources materially disagree. LIVE Signals: {c_live_proof} {h_live_proof}. VIRTUAL Signals: {c_virt_proof} {h_virt_proof} {v_virt_proof}")
                return ClassificationResult(
                    participation_type=ParticipationType.CONFLICT,
                    confidence=ConfidenceLevel.LOW,
                    classification_reason="Evidence sources materially disagree and cannot safely be reconciled.",
                    evidence_summary=evidence_trace,
                    raw_evidence_chain=raw_chain
                )

        # 2. TIER A: OFFICIAL LEADERBOARD (LIVE)
        if c_is_live and getattr(c_ev, "source", None) in ["contest_ranking", "final_contest"]:
            evidence_trace.append("✓ Strong LIVE evidence: Official contest leaderboard match.")
            if h_is_live:
                evidence_trace.append("✓ Supporting LIVE evidence: Profile attended=true.")
                conf = ConfidenceLevel.VERY_HIGH
            else:
                evidence_trace.append("! Note: Profile history has not yet synced or is missing (acceptable for Leaderboard match).")
                conf = ConfidenceLevel.HIGH

            return ClassificationResult(
                participation_type=ParticipationType.LIVE,
                confidence=conf,
                classification_reason="Found in official live contest leaderboard.",
                evidence_summary=evidence_trace,
                rank=c_ev.rank,
                score=c_ev.score,
                solved_count=self._get_solved_count(c_ev),
                finish_time=c_ev.finish_time,
                questions=c_ev.questions or [],
                raw_evidence_chain=raw_chain
            )

        # 3. TIER B: PROFILE ATTENDED (LIVE)
        if h_is_live:
            evidence_trace.append("✓ Strong LIVE evidence: Profile explicitly marks attended=true, virtual=false.")
            return ClassificationResult(
                participation_type=ParticipationType.LIVE,
                confidence=ConfidenceLevel.HIGH,
                classification_reason="Profile GraphQL explicitly indicates live attendance.",
                evidence_summary=evidence_trace,
                rank=h_ev.rank,
                solved_count=h_ev.problems_solved,
                raw_evidence_chain=raw_chain
            )

        # 4. TIER C: EXPLICIT VIRTUAL EVIDENCE
        if v_is_virtual or c_is_virtual or (h_is_virtual and getattr(h_ev, "virtual_contest", False)):
            evidence_trace.append("✓ Strong VIRTUAL evidence: Explicit virtual flag detected.")
            source_ev = v_ev or c_ev or h_ev
            
            # Use data from the most relevant source
            metrics_src = v_ev if v_ev else (h_ev if h_ev else c_ev)
            
            return ClassificationResult(
                participation_type=ParticipationType.VIRTUAL,
                confidence=ConfidenceLevel.HIGH,
                classification_reason="Explicit virtual participation flag confirmed.",
                evidence_summary=evidence_trace,
                rank=getattr(metrics_src, "rank", None),
                score=getattr(metrics_src, "score", None) if not isinstance(metrics_src, UserContestHistoryEntry) else None,
                solved_count=self._get_solved_count(metrics_src),
                questions=getattr(metrics_src, "questions", []),
                raw_evidence_chain=raw_chain
            )

        # 5. TIER D: SMART VIRTUAL INFERENCE
        if h_is_virtual and getattr(h_ev, "attended", None) is False:
            evidence_trace.append("✓ Inferred VIRTUAL evidence: Profile indicates attended=false but problems_solved > 0.")
            return ClassificationResult(
                participation_type=ParticipationType.VIRTUAL,
                confidence=ConfidenceLevel.MODERATE,
                classification_reason="Inferred virtual participation based on positive solved count despite not attending live.",
                evidence_summary=evidence_trace,
                rank=h_ev.rank,
                solved_count=h_ev.problems_solved,
                raw_evidence_chain=raw_chain
            )

        # 6. RELIABLE NOT_ATTENDED
        if h_ev and getattr(h_ev, "attended", None) is False and getattr(h_ev, "problems_solved", 0) == 0:
            evidence_trace.append("✓ Reliable NOT_ATTENDED evidence: Profile explicitly marks attended=false and 0 problems solved.")
            return ClassificationResult(
                participation_type=ParticipationType.NOT_ATTENDED,
                confidence=ConfidenceLevel.HIGH,
                classification_reason="Profile confirms zero participation for this contest.",
                evidence_summary=evidence_trace,
                solved_count=0,
                raw_evidence_chain=raw_chain
            )

        # 7. UNKNOWN (Insufficient Evidence)
        evidence_trace.append("? Insufficient evidence: No matching leaderboard or profile records found.")
        return ClassificationResult(
            participation_type=ParticipationType.UNKNOWN,
            confidence=ConfidenceLevel.LOW,
            classification_reason="No reliable LeetCode evidence found to determine status.",
            evidence_summary=evidence_trace,
            raw_evidence_chain=raw_chain
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

    def _get_solved_count(self, ev: Any) -> Optional[int]:
        if not ev:
            return None
        if hasattr(ev, "solved_count") and ev.solved_count is not None:
            return ev.solved_count
        if hasattr(ev, "submission_count") and ev.submission_count is not None:
            return ev.submission_count
        if hasattr(ev, "problems_solved") and ev.problems_solved is not None:
            return ev.problems_solved
        return None

    def _is_live_signal(self, ev: Any, src_name: str) -> tuple[bool, str]:
        if not ev:
            return False, ""
        if isinstance(ev, UserContestResult):
            if ev.is_virtual or ev.is_explicit_virtual:
                return False, ""
            if ev.source in ["contest_ranking", "contest_participation", "final_contest"]:
                # Must have positive submission proof to be strongly LIVE
                has_submissions = (
                    (ev.submission_count is not None and ev.submission_count > 0)
                    or (ev.attempt_count is not None and ev.attempt_count > 0)
                    or (ev.solved_count is not None and ev.solved_count > 0)
                    or (ev.score is not None and ev.score > 0)
                    or (ev.has_submission_records is True)
                )
                if has_submissions:
                    return True, f"[{src_name}: Official Match]"
            if ev.attended is True and not ev.is_virtual:
                return True, f"[{src_name}: Attended True]"
        elif isinstance(ev, UserContestHistoryEntry):
            if ev.attended is True and not ev.virtual_contest:
                return True, f"[{src_name}: Profile Attended True]"
        return False, ""

    def _is_virtual_signal(self, ev: Any, src_name: str) -> tuple[bool, str]:
        if not ev:
            return False, ""
        if isinstance(ev, UserContestResult):
            if ev.is_virtual or ev.is_explicit_virtual:
                return True, f"[{src_name}: Explicit Virtual Flag]"
        elif isinstance(ev, UserContestHistoryEntry):
            if ev.virtual_contest is True:
                return True, f"[{src_name}: Profile Virtual Flag]"
            if ev.attended is False and ev.problems_solved > 0:
                return True, f"[{src_name}: Inferred Virtual (Solved > 0)]"
        return False, ""
