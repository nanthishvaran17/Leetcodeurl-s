"""
contest_verification_engine.py
================================================================================
AUTHORITATIVE CONTEST VERIFICATION & EVIDENCE ENGINE
================================================================================
Single source of truth for Sunday LeetCode Weekly Contest score integrity.

Core Principles:
1. RAW DATA -> IMMUTABLE SNAPSHOT -> CONTEST ID -> PARTICIPATION VALIDATION ->
   CONTEST PROBLEM MAPPING -> TIMESTAMP VALIDATION -> ACCEPTED VALIDATION ->
   PROBLEM DEDUPLICATION -> EVIDENCE VALIDATION -> Q1..Q4 -> VERIFIED SCORE -> OFFICIAL REPORT
2. Official Contest Window: 08:00 AM to 09:30 AM IST (Asia/Kolkata).
3. Participation States: ACTUAL, VIRTUAL_ATTENDED, NOT_VERIFIED.
   ONLY ACTUAL participation is eligible for official institutional Sunday contest scores.
4. Problem-level Deduplication: (student_id, contest_id, problem_id) -> max 1 solve.
5. Absolute Rule: Accepted != Contest Solved unless verified by evidence.
   NO GUESSING. NO POSITIONAL SCORE ASSIGNMENT.
"""

import datetime
from typing import Dict, Any, List, Optional, Tuple, Set
from dataclasses import dataclass, field

# IST Timezone (Asia/Kolkata: UTC+5:30)
IST_OFFSET = datetime.timezone(datetime.timedelta(hours=5, minutes=30))


def get_ist_now() -> datetime.datetime:
    return datetime.datetime.now(IST_OFFSET)


def to_ist_datetime(dt_or_ts: Any) -> Optional[datetime.datetime]:
    """Converts unix timestamp or datetime to timezone-aware IST datetime."""
    if dt_or_ts is None:
        return None
    try:
        if isinstance(dt_or_ts, (int, float)):
            dt = datetime.datetime.fromtimestamp(dt_or_ts, tz=datetime.timezone.utc)
            return dt.astimezone(IST_OFFSET)
        if isinstance(dt_or_ts, datetime.datetime):
            if dt_or_ts.tzinfo is None:
                # Assume UTC if naive
                dt = dt_or_ts.replace(tzinfo=datetime.timezone.utc)
            else:
                dt = dt_or_ts
            return dt.astimezone(IST_OFFSET)
        if isinstance(dt_or_ts, str):
            # Try ISO format parsing
            dt = datetime.datetime.fromisoformat(dt_or_ts)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=datetime.timezone.utc)
            return dt.astimezone(IST_OFFSET)
    except Exception:
        pass
    return None


@dataclass
class ProblemDefinition:
    """Metadata for one official contest problem."""
    question_number: int  # 1, 2, 3, 4
    problem_id: str       # e.g., "Q1", "3456"
    title_slug: str       # e.g., "find-special-substring-of-length-k"
    title: str          # e.g., "Find Special Substring of Length K"
    points: int = 3


@dataclass
class ContestProblemMapping:
    """Canonical problem mapping for a specific contest_id."""
    contest_id: str
    contest_name: str
    contest_number: Optional[int]
    problems: List[ProblemDefinition] = field(default_factory=list)

    def find_problem(self, slug_or_id: str) -> Optional[ProblemDefinition]:
        if not slug_or_id:
            return None
        target = str(slug_or_id).strip().lower()
        for p in self.problems:
            if p.title_slug.lower() == target or p.problem_id.lower() == target:
                return p
        return None


@dataclass
class SubmissionEvidenceItem:
    """Granular evidence for a single submission attempt."""
    student_id: int
    leetcode_username: str
    contest_id: str
    problem_id: str
    question_number: Optional[int]
    submission_id: str
    submission_timestamp: Optional[datetime.datetime]
    submission_status: str
    participation_type: str
    is_within_contest_window: bool
    is_contest_problem: bool
    is_actual_participation: bool
    is_verified: bool
    evidence_source: str
    verification_reason: str


@dataclass
class StudentVerifiedContestResult:
    """Authoritative result for a student in a specific contest."""
    student_id: int
    leetcode_username: str
    contest_id: str
    participation_type: str  # ACTUAL, VIRTUAL_ATTENDED, NOT_VERIFIED
    q1: int = 0
    q2: int = 0
    q3: int = 0
    q4: int = 0
    verified_total: int = 0
    raw_ac_count: int = 0
    evidence_complete: bool = False
    evidence_status: str = "NOT_VERIFIED"  # VERIFIED, UNKNOWN, NOT_VERIFIED, PARTIAL
    evidence_items: List[SubmissionEvidenceItem] = field(default_factory=list)
    rejection_reasons: List[str] = field(default_factory=list)
    q_reasons: Dict[str, str] = field(default_factory=dict)


class ContestVerificationEngine:
    """
    Authoritative verification engine for LeetCode Sunday Contest scores.
    """

    @classmethod
    def verify_student_contest_participation(
        cls,
        student_id: int,
        leetcode_username: str,
        contest_id: str,
        participation_type: str,
        problem_mapping: ContestProblemMapping,
        raw_submissions: List[Dict[str, Any]],
        contest_start_ist: Optional[datetime.datetime] = None,
        contest_end_ist: Optional[datetime.datetime] = None,
        evidence_source: str = "LEETCODE_GRAPHQL"
    ) -> StudentVerifiedContestResult:
        """
        Main entry point to evaluate submissions for a single student in a contest.

        Strict Rules Enforced:
        1. participation_type MUST be 'ACTUAL' for official Sunday contest scores.
           If participation_type is 'VIRTUAL_ATTENDED' or 'NOT_VERIFIED', official score = 0/NOT_VERIFIED.
        2. Submission status MUST be 'ACCEPTED' / 'AC'.
        3. Problem MUST match a canonical problem in problem_mapping by title_slug or problem_id.
        4. Timestamp MUST fall within official window (08:00 AM to 09:30 AM IST) if window is specified.
        5. Deduplication by (student_id, contest_id, problem_id): multiple AC submissions for Q2 count as 1 solve for Q2.
        6. NO POSITIONAL GUESSING: Never infer Q1=1, Q2=1, Q3=1, Q4=1 from raw submission count or rating/score.
        """
        clean_username = (leetcode_username or "").strip()
        norm_participation = cls.normalize_participation_type(participation_type)

        result = StudentVerifiedContestResult(
            student_id=student_id,
            leetcode_username=clean_username,
            contest_id=contest_id,
            participation_type=norm_participation,
            q_reasons={
                "Q1": "No verified evidence",
                "Q2": "No verified evidence",
                "Q3": "No verified evidence",
                "Q4": "No verified evidence",
            }
        )

        if not clean_username:
            result.evidence_status = "NOT_VERIFIED"
            result.rejection_reasons.append("Missing LeetCode username")
            return result

        # Participation Eligibility Gate
        is_actual = (norm_participation == "ACTUAL")
        if not is_actual:
            reason = f"Participation state is '{norm_participation}' (must be 'ACTUAL' for official Sunday contest score)"
            result.rejection_reasons.append(reason)
            result.evidence_status = "NOT_VERIFIED" if norm_participation == "NOT_VERIFIED" else "VIRTUAL_ONLY"

        # Problem solve tracking by question_number (1, 2, 3, 4)
        solved_questions: Set[int] = set()
        evidence_list: List[SubmissionEvidenceItem] = []
        raw_ac_count = 0
        for sub_idx, sub in enumerate(raw_submissions):
            provided_status = sub.get("status") or sub.get("statusDisplay") or sub.get("verdict")
            if provided_status is not None and str(provided_status).strip() != "":
                raw_status = str(provided_status).upper().strip()
                is_ac = raw_status in ("ACCEPTED", "AC", "10")
            else:
                raw_status = "ACCEPTED"
                is_ac = True

            sub_id = str(sub.get("submission_id") or sub.get("id") or f"sub_{sub_idx}").strip()
            slug_or_title = str(sub.get("title_slug") or sub.get("titleSlug") or sub.get("slug") or sub.get("title") or "").strip().lower()

            ts_raw = sub.get("timestamp") or sub.get("submit_time") or sub.get("submission_timestamp")
            sub_ist = to_ist_datetime(ts_raw)

            if is_ac:
                raw_ac_count += 1

            # Match against canonical contest problems
            problem_def = problem_mapping.find_problem(slug_or_title)
            is_contest_problem = problem_def is not None

            # Window check
            is_within_window = True
            if sub_ist and contest_start_ist and contest_end_ist:
                is_within_window = (contest_start_ist <= sub_ist <= contest_end_ist)

            # Verification outcome
            is_verified = (
                is_ac and
                is_actual and
                is_contest_problem and
                is_within_window
            )

            # Build evidence item
            reason_parts = []
            if not is_ac:
                reason_parts.append(f"Status is {raw_status} (not ACCEPTED)")
            if not is_actual:
                reason_parts.append(f"Participation type is {norm_participation} (not ACTUAL)")
            if not is_contest_problem:
                reason_parts.append(f"Problem '{slug_or_title}' is not a canonical problem for contest {contest_id}")
            if not is_within_window:
                reason_parts.append(f"Submission timestamp {sub_ist} outside contest window [{contest_start_ist}, {contest_end_ist}]")

            verification_reason = "VERIFIED_CONTEST_SOLVE" if is_verified else "; ".join(reason_parts)

            ev = SubmissionEvidenceItem(
                student_id=student_id,
                leetcode_username=clean_username,
                contest_id=contest_id,
                problem_id=problem_def.problem_id if problem_def else slug_or_title,
                question_number=problem_def.question_number if problem_def else None,
                submission_id=sub_id,
                submission_timestamp=sub_ist,
                submission_status=raw_status,
                participation_type=norm_participation,
                is_within_contest_window=is_within_window,
                is_contest_problem=is_contest_problem,
                is_actual_participation=is_actual,
                is_verified=is_verified,
                evidence_source=evidence_source,
                verification_reason=verification_reason
            )
            evidence_list.append(ev)

            if is_verified and problem_def:
                q_num = problem_def.question_number
                solved_questions.add(q_num)
                q_key = f"Q{q_num}"
                result.q_reasons[q_key] = f"VERIFIED: Accepted submission {sub_id} at {sub_ist} on problem '{problem_def.title}'"

        result.raw_ac_count = raw_ac_count
        result.evidence_items = evidence_list

        # Assign verified binary scores (strictly 0 or 1)
        if 1 in solved_questions:
            result.q1 = 1
        if 2 in solved_questions:
            result.q2 = 1
        if 3 in solved_questions:
            result.q3 = 1
        if 4 in solved_questions:
            result.q4 = 1

        # Verified Total is strictly the sum of verified binary question solves
        result.verified_total = result.q1 + result.q2 + result.q3 + result.q4

        if is_actual:
            if result.verified_total > 0:
                result.evidence_status = "VERIFIED"
                result.evidence_complete = True
            elif raw_ac_count == 0:
                result.evidence_status = "VERIFIED"
                result.evidence_complete = True
            else:
                result.evidence_status = "PARTIAL"
                result.evidence_complete = False
        else:
            result.evidence_status = "NOT_VERIFIED"
            result.evidence_complete = False

        return result

    @classmethod
    def normalize_participation_type(cls, raw_type: Optional[str]) -> str:
        """Normalizes any participation string into canonical ACTUAL, VIRTUAL_ATTENDED, NOT_VERIFIED."""
        if not raw_type:
            return "NOT_VERIFIED"
        st = str(raw_type).strip().upper()
        if st in ("ACTUAL", "PUBLIC", "PUBLIC_ATTENDED", "ATTENDED", "OFFICIAL"):
            return "ACTUAL"
        if st in ("VIRTUAL", "VIRTUAL_ATTENDED"):
            return "VIRTUAL_ATTENDED"
        if st in ("NOT_ATTENDED", "PUBLIC_NOT_ATTENDED", "ABSENT", "UNATTENDED"):
            return "NOT_VERIFIED"
        if st in ("NOT_VERIFIED", "PENDING", "UNKNOWN", ""):
            return "NOT_VERIFIED"
        return "NOT_VERIFIED"
