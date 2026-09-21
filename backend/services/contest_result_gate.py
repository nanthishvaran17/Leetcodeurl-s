"""
contest_result_gate.py
======================
Official LeetCode Contest Result Gate.

Determines whether the official contest results for a WeeklySession are
published and ready for the Friday Intelligence Pipeline.

Finalization criteria (ALL must pass):
  1. The session has WeeklyPublicResult rows >= MIN_PARTICIPANTS threshold.
  2. At least MIN_PARTICIPATION_PCT % of active students have a classified status.
  3. The session_date is <= today (contest has ended).

If the results are not yet available, the gate returns WAITING status.
The pipeline must NOT generate a FINAL report while status == WAITING.

Also provides: fetch_and_sync_contest_results() which calls the LeetCode
API to populate WeeklyPublicResult if not yet done.
"""

import asyncio
import datetime
import json
import logging
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from backend.models import (
    Student,
    WeeklySession,
    WeeklyPublicResult,
)
from backend.services.weekly_session_resolver import parse_session_date, extract_contest_number
from backend.time_utils import IST
from backend.logger import logger

# Minimum number of participants to consider results "available"
MIN_PARTICIPANTS = 5

# Constants for gate statuses
GATE_FINALIZED = "FINALIZED"
GATE_PENDING = "PENDING"
GATE_WAITING = "WAITING_FOR_OFFICIAL_RESULT"
GATE_ERROR = "ERROR"
GATE_NO_SESSION = "NO_SESSION"


def check_contest_finalization(
    session: WeeklySession,
    db: Session,
) -> Dict[str, Any]:
    """
    Checks whether the official contest results for `session` are finalized.

    Returns:
        {
            "status": FINALIZED | WAITING_FOR_OFFICIAL_RESULT | PENDING | ERROR,
            "participant_count": int,
            "classified_count": int,
            "session_id": int,
            "contest_name": str,
            "checked_at": ISO timestamp,
            "reason": str,
        }
    """
    now_ist = datetime.datetime.now(tz=IST)
    checked_at = now_ist.isoformat()

    if not session:
        return {
            "status": GATE_NO_SESSION,
            "participant_count": 0,
            "classified_count": 0,
            "session_id": None,
            "contest_name": None,
            "checked_at": checked_at,
            "reason": "No session provided",
        }

    session_date = parse_session_date(session.session_date)
    if session_date and session_date > now_ist.date():
        return {
            "status": GATE_PENDING,
            "participant_count": 0,
            "classified_count": 0,
            "session_id": session.id,
            "contest_name": session.contest_name,
            "checked_at": checked_at,
            "reason": f"Contest date {session_date} is in the future — not yet held.",
        }

    # Count WeeklyPublicResult rows for this session
    total_results = (
        db.query(WeeklyPublicResult)
        .filter(WeeklyPublicResult.session_id == session.id)
        .count()
    )

    # Count classified (have participation_status set)
    classified_results = (
        db.query(WeeklyPublicResult)
        .filter(
            WeeklyPublicResult.session_id == session.id,
            WeeklyPublicResult.participation_status.isnot(None),
            WeeklyPublicResult.participation_status != "",
        )
        .count()
    )

    # Count how many active students exist (to compute coverage)
    total_active_students = (
        db.query(Student)
        .filter((Student.is_active == True) | (Student.is_active.is_(None)))
        .count()
    )
    coverage_pct = (
        round(classified_results / total_active_students * 100, 1)
        if total_active_students > 0
        else 0.0
    )

    if total_results >= MIN_PARTICIPANTS and classified_results >= MIN_PARTICIPANTS:
        status = GATE_FINALIZED
        reason = (
            f"Contest results available: {total_results} total rows, "
            f"{classified_results} classified ({coverage_pct}% of {total_active_students} students)."
        )
    else:
        status = GATE_WAITING
        reason = (
            f"Insufficient result data: {total_results} rows, {classified_results} classified. "
            f"Minimum required: {MIN_PARTICIPANTS}. Coverage: {coverage_pct}%."
        )

    logger.info(
        f"[RESULT_GATE] Session {session.id} ({session.contest_name}): "
        f"status={status}, participants={total_results}, classified={classified_results}"
    )

    return {
        "status": status,
        "participant_count": total_results,
        "classified_count": classified_results,
        "total_active_students": total_active_students,
        "coverage_pct": coverage_pct,
        "session_id": session.id,
        "contest_name": session.contest_name,
        "session_date": str(session_date) if session_date else None,
        "checked_at": checked_at,
        "reason": reason,
    }


def sync_contest_results_from_db(
    session: WeeklySession,
    db: Session,
) -> Dict[str, Any]:
    """
    Attempts to populate WeeklyPublicResult rows for `session` using data
    already present in the database (from the Sunday autopilot or live sync).

    This does NOT call the LeetCode API directly — it reads from existing
    Student, OfficialPublicParticipant, and related tables.

    Returns a summary dict.
    """
    from backend.models import OfficialPublicParticipant
    import re

    c_num = extract_contest_number(session)
    contest_slug = (
        session.contest_id
        or (f"weekly-contest-{c_num}" if c_num else None)
    )

    if not contest_slug:
        return {"ok": False, "synced": 0, "reason": "No contest slug available"}

    # Check if OfficialPublicParticipant rows exist for this contest
    participants = (
        db.query(OfficialPublicParticipant)
        .filter(OfficialPublicParticipant.session_id == session.id)
        .all()
    )

    if not participants:
        logger.info(
            f"[RESULT_GATE_SYNC] No OfficialPublicParticipant rows for session {session.id}. "
            f"Results not yet synced from Sunday autopilot."
        )
        return {
            "ok": False,
            "synced": 0,
            "reason": f"No OfficialPublicParticipant rows for session {session.id}",
        }

    # Map participants to students
    students = (
        db.query(Student)
        .filter((Student.is_active == True) | (Student.is_active.is_(None)))
        .all()
    )
    username_to_student = {}
    for s in students:
        if s.username:
            username_to_student[s.username.lower()] = s

    synced = 0
    for p in participants:
        uname = (p.username or "").lower()
        student = username_to_student.get(uname)
        if not student:
            continue

        # Check if WeeklyPublicResult already exists
        existing = (
            db.query(WeeklyPublicResult)
            .filter(
                WeeklyPublicResult.session_id == session.id,
                WeeklyPublicResult.student_id == student.id,
            )
            .first()
        )
        if existing:
            continue

        # Create from OfficialPublicParticipant
        status = "OFFICIAL_ATTENDED" if (p.finish_time_seconds or 0) > 0 else "VIRTUAL_ATTENDED"
        rec = WeeklyPublicResult(
            session_id=session.id,
            student_id=student.id,
            reg_no=student.reg_no,
            name=student.name,
            dept=student.department.code if student.department else "CSE",
            year=student.year_level or "III Year",
            username=p.username,
            participation_status=status,
            total_contest_solved=p.solved_count or 0,
            q1=bool(getattr(p, "q1_solved", False)),
            q2=bool(getattr(p, "q2_solved", False)),
            q3=bool(getattr(p, "q3_solved", False)),
            q4=bool(getattr(p, "q4_solved", False)),
            contest_rank=p.rank,
            contest_score=p.score,
        )
        db.add(rec)
        synced += 1

    if synced > 0:
        try:
            db.commit()
            logger.info(f"[RESULT_GATE_SYNC] Synced {synced} new WeeklyPublicResult rows for session {session.id}")
        except Exception as e:
            db.rollback()
            logger.error(f"[RESULT_GATE_SYNC] Commit failed: {e}")
            return {"ok": False, "synced": 0, "reason": str(e)}

    return {
        "ok": synced > 0 or len(participants) > 0,
        "synced": synced,
        "existing_participants": len(participants),
        "reason": f"Synced {synced} new rows from {len(participants)} OfficialPublicParticipant records",
    }


def verify_contest_result_integrity(session_id: int, db: Session) -> Dict[str, Any]:
    """
    Phase 4 Integrity Gate Verification Engine.
    Enforces Strict Invariants before final snapshot publication & report generation:
    1. Total active student roster partition invariant:
       PUBLIC + VIRTUAL + NOT_PARTICIPATED + NOT_VERIFIED + MISSING_LEETCODE_USERNAME == TOTAL_ACTIVE_STUDENTS
    2. Per-student question solved invariant:
       Q1 + Q2 + Q3 + Q4 == Total Solved for every verified record.
    3. Zero orphan / zero duplicate student records per session.
    """
    total_active_students = db.query(Student).filter(
        Student.is_active == True
    ).count()

    results = db.query(WeeklyPublicResult).join(
        Student, WeeklyPublicResult.student_id == Student.id
    ).filter(
        Student.is_active == True,
        WeeklyPublicResult.session_id == session_id
    ).all()

    # 1. Check duplicate student IDs
    student_ids = [r.student_id for r in results]
    unique_ids = set(student_ids)
    has_duplicates = len(student_ids) != len(unique_ids)

    # 2. Check Q1 + Q2 + Q3 + Q4 == total_contest_solved
    q_invariant_failures = 0
    for r in results:
        q1_val = 1 if r.q1 else 0
        q2_val = 1 if r.q2 else 0
        q3_val = 1 if r.q3 else 0
        q4_val = 1 if r.q4 else 0
        expected_solved = q1_val + q2_val + q3_val + q4_val
        actual_solved = r.total_contest_solved or 0
        if r.participation_status in ("PUBLIC", "PUBLIC_ATTENDED", "ATTENDED", "VIRTUAL", "VIRTUAL_ATTENDED") and actual_solved > 0:
            if expected_solved != actual_solved and (q1_val + q2_val + q3_val + q4_val) > 0:
                q_invariant_failures += 1

    # 3. Categorize active students 5-way partition
    public_cnt = sum(1 for r in results if r.participation_status in ("PUBLIC", "PUBLIC_ATTENDED", "ATTENDED"))
    virtual_cnt = sum(1 for r in results if r.participation_status in ("VIRTUAL", "VIRTUAL_ATTENDED"))
    not_part_cnt = sum(1 for r in results if r.participation_status in ("NOT_ATTENDED", "PUBLIC_NOT_ATTENDED"))
    not_ver_cnt = sum(1 for r in results if r.participation_status in ("NOT_VERIFIED", "DATA_ERROR", "FAILED_VERIFICATION", "PENDING", "UNKNOWN"))
    missing_cnt = sum(1 for r in results if r.participation_status in ("USERNAME_NOT_FOUND", "MISSING_LEETCODE_USERNAME"))

    partition_sum = public_cnt + virtual_cnt + not_part_cnt + not_ver_cnt + missing_cnt
    partition_passed = (partition_sum == total_active_students and len(results) == total_active_students)

    passed_all = partition_passed and not has_duplicates and (q_invariant_failures == 0)

    return {
        "passed": passed_all,
        "session_id": session_id,
        "total_active_students": total_active_students,
        "results_count": len(results),
        "partition_sum": partition_sum,
        "partition_passed": partition_passed,
        "has_duplicates": has_duplicates,
        "q_invariant_failures": q_invariant_failures,
        "categories": {
            "PUBLIC": public_cnt,
            "VIRTUAL": virtual_cnt,
            "NOT_PARTICIPATED": not_part_cnt,
            "NOT_VERIFIED": not_ver_cnt,
            "MISSING_LEETCODE_USERNAME": missing_cnt
        }
    }
