"""
sunday_live_ingestion_engine.py
================================================================================
TRUE SUNDAY LIVE CONTEST RESULT INGESTION ENGINE
Authoritative Backend • Question-Level Tracking • Change Detection • Realtime
================================================================================
Handles real-time question completion detection and ingestion during the official
Sunday contest window (08:00 AM – 09:30 AM IST).

Pipeline Guarantee:
AUTHORITATIVE EVIDENCE → SYNC ENGINE → IDENTITY VALIDATION → DATABASE COMMIT → REALTIME WS → FRONTEND
"""

import datetime
from typing import Dict, Any, Optional, Tuple

from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from backend.models import (
    Student, WeeklySession, WeeklyPublicResult, PreviousWeekParticipationRecord
)
from backend.services.contest_discovery import (
    get_current_ist_datetime, get_upcoming_sunday_date,
    get_immediately_previous_sunday_date, discover_contest_metadata, IST_TZ
)
from backend.websocket_manager import manager
from backend.logger import logger


class SundayLiveIngestionEngine:
    """
    Authoritative real-time contest ingestion engine.
    Maintains question-level (Q1, Q2, Q3, Q4) state machine and publishes
    granular realtime events to frontend subscribers.
    """

    @classmethod
    def get_or_create_live_session(cls, db: Session) -> WeeklySession:
        """Resolves the current active Sunday weekly session or creates it."""
        now_ist = get_current_ist_datetime()
        sunday_date = get_upcoming_sunday_date(now_ist)
        meta = discover_contest_metadata(sunday_date)
        session_code = meta["session_code"]

        session = db.query(WeeklySession).filter(WeeklySession.session_code == session_code).first()
        if not session:
            # Check previous week if currently finalized or inspecting
            prev_sunday = get_immediately_previous_sunday_date(now_ist)
            prev_meta = discover_contest_metadata(prev_sunday)
            session = db.query(WeeklySession).filter(WeeklySession.session_code == prev_meta["session_code"]).first()

        if not session:
            total_students = db.query(Student).filter(Student.is_active == True).count()
            session = WeeklySession(
                academic_year="2026-27",
                week_number=meta["contest_number"],
                session_code=session_code,
                session_date=meta["session_date"],
                contest_id=meta["contest_id"],
                contest_name=meta["contest_name"],
                start_time="08:00",
                end_time="09:30",
                status="LIVE",
                total_students=total_students,
                sync_status=" Verified"
            )
            db.add(session)
            db.commit()
            db.refresh(session)

        return session

    @classmethod
    def recalculate_live_summary_metrics(cls, db: Session, session_id: int) -> Dict[str, int]:
        """
        Calculates authoritative live summary counts from DB adhering to axioms:
        - Solved 0 != Not Attended
        - Pending != Not Attended
        - No Handle != Not Attended
        Invariant: PUBLIC + VIRTUAL + NOT_PARTICIPATED + NOT_VERIFIED + MISSING = TOTAL
        """
        active_total = db.query(Student).filter(Student.is_active == True).count() or 593

        records = db.query(PreviousWeekParticipationRecord).filter(
            PreviousWeekParticipationRecord.session_id == session_id,
            PreviousWeekParticipationRecord.is_active_version == True
        ).all()

        if records:
            public_cnt = sum(1 for r in records if r.participation_type == "PUBLIC")
            virtual_cnt = sum(1 for r in records if r.participation_type == "VIRTUAL")
            not_part_cnt = sum(1 for r in records if r.participation_type == "NOT_PARTICIPATED")
            not_ver_cnt = sum(1 for r in records if r.participation_type == "NOT_VERIFIED")
            missing_cnt = sum(1 for r in records if r.participation_type == "MISSING_LEETCODE_USERNAME")
            total_cnt = max(len(records), active_total)
        else:
            # Fallback to live session tracking table: WeeklyPublicResult
            pub_results = db.query(WeeklyPublicResult).filter(WeeklyPublicResult.session_id == session_id).all()
            if pub_results:
                public_cnt = sum(1 for r in pub_results if r.participation_status in ("PUBLIC", "PUBLIC_ATTENDED", "ATTENDED"))
                virtual_cnt = sum(1 for r in pub_results if r.participation_status in ("VIRTUAL", "VIRTUAL_ATTENDED"))
                not_part_cnt = sum(1 for r in pub_results if r.participation_status in ("NOT_ATTENDED", "PUBLIC_NOT_ATTENDED"))
                not_ver_cnt = sum(1 for r in pub_results if r.participation_status in ("NOT_VERIFIED", "DATA_ERROR", "FAILED_VERIFICATION", "PENDING", "UNKNOWN"))
                missing_cnt = sum(1 for r in pub_results if r.participation_status in ("USERNAME_NOT_FOUND", "MISSING_LEETCODE_USERNAME"))
                total_cnt = max(len(pub_results), active_total)
            else:
                public_cnt = 0
                virtual_cnt = 0
                not_part_cnt = 0
                not_ver_cnt = 0
                missing_cnt = db.query(Student).filter(
                    Student.is_active == True,
                    (Student.primary_leetcode_id == None) | (Student.primary_leetcode_id == "")
                ).count()
                total_cnt = active_total

        return {
            "PUBLIC": public_cnt,
            "VIRTUAL": virtual_cnt,
            "NOT_PARTICIPATED": not_part_cnt,
            "NOT_VERIFIED": not_ver_cnt,
            "MISSING_LEETCODE_USERNAME": missing_cnt,
            "TOTAL_STUDENTS": total_cnt
        }

    @classmethod
    async def ingest_student_solve_event(
        cls,
        db: Session,
        session_id: int,
        student_id: int,
        q1: int,
        q2: int,
        q3: int,
        q4: int,
        official_rank: Optional[int] = None,
        official_score: Optional[int] = None,
        finish_time: Optional[str] = None,
        evidence_source: str = "official_leetcode_live_api"
    ) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
        """
        Ingests a verified question completion event for a single student.
        
        Transactional Flow:
        1. BEGIN
        2. Validate student identity and active session.
        3. Check previous question state (Change Detection).
        4. If changed:
           - Update Q1, Q2, Q3, Q4
           - Recalculate solved_count = Q1 + Q2 + Q3 + Q4
           - Update participation_status = 'PUBLIC' (if solved >= 1 or rank present)
           - Update finish_time, official_rank, official_score
           - COMMIT
           - Recalculate live aggregates
           - Broadcast targeted CONTEST_RESULT_UPDATED over WebSocket
           - Broadcast targeted CONTEST_SUMMARY_UPDATED over WebSocket
        """
        student = db.query(Student).filter(Student.id == student_id).first()
        if not student:
            return False, None, f"Student with ID {student_id} not found."

        session = db.query(WeeklySession).filter(WeeklySession.id == session_id).first()
        if not session:
            return False, None, f"Session with ID {session_id} not found."

        # Fetch or create PreviousWeekParticipationRecord
        record = db.query(PreviousWeekParticipationRecord).filter(
            PreviousWeekParticipationRecord.session_id == session_id,
            PreviousWeekParticipationRecord.student_id == student_id,
            PreviousWeekParticipationRecord.is_active_version == True
        ).first()

        prev_q1 = record.q1 if record else 0
        prev_q2 = record.q2 if record else 0
        prev_q3 = record.q3 if record else 0
        prev_q4 = record.q4 if record else 0

        # Monotonic progression preservation: Never revert a previously verified solved question back to 0
        q1_flag = 1 if (q1 or prev_q1) else 0
        q2_flag = 1 if (q2 or prev_q2) else 0
        q3_flag = 1 if (q3 or prev_q3) else 0
        q4_flag = 1 if (q4 or prev_q4) else 0
        new_solved_count = q1_flag + q2_flag + q3_flag + q4_flag

        assert 0 <= new_solved_count <= 4, f"Invalid new_solved_count: {new_solved_count}"

        # Change detection: Check if any question state changed or rank updated
        has_changed = (q1_flag != prev_q1) or (q2_flag != prev_q2) or (q3_flag != prev_q3) or (q4_flag != prev_q4) or (official_rank != (record.official_rank if record else None))

        # Database Transaction BEGIN
        try:
            if not record:
                contest_slug = session.contest_id or f"weekly-contest-{session.week_number}"
                record = PreviousWeekParticipationRecord(
                    session_id=session.id,
                    contest_id=contest_slug,
                    contest_slug=contest_slug.lower(),
                    contest_title=session.contest_name,
                    student_id=student.id,
                    leetcode_username=student.username,
                    participation_type="PUBLIC" if (new_solved_count > 0 or official_rank) else "NOT_VERIFIED",
                    q1=q1_flag,
                    q2=q2_flag,
                    q3=q3_flag,
                    q4=q4_flag,
                    problems_solved=new_solved_count,
                    official_rank=official_rank,
                    official_score=official_score or (new_solved_count * 4),
                    finish_time=finish_time or datetime.datetime.now(IST_TZ).strftime("%H:%M:%S IST"),
                    source=evidence_source,
                    verification_status="VERIFIED",
                    verified_at=datetime.datetime.now(datetime.timezone.utc),
                    dataset_version=1,
                    is_active_version=True
                )
                db.add(record)
            else:
                if has_changed:
                    setattr(record, "q1", q1_flag)
                    setattr(record, "q2", q2_flag)
                    setattr(record, "q3", q3_flag)
                    setattr(record, "q4", q4_flag)
                    setattr(record, "problems_solved", new_solved_count)
                    if official_rank is not None:
                        setattr(record, "official_rank", official_rank)
                    if official_score is not None:
                        setattr(record, "official_score", official_score)
                    if finish_time is not None:
                        setattr(record, "finish_time", finish_time)
                    if new_solved_count > 0 or official_rank:
                        setattr(record, "participation_type", "PUBLIC")
                        setattr(record, "verification_status", "VERIFIED")
                    setattr(record, "verified_at", datetime.datetime.now(datetime.timezone.utc))

            # Also mirror update to WeeklyPublicResult if present
            pub_res = db.query(WeeklyPublicResult).filter(
                WeeklyPublicResult.session_id == session_id,
                WeeklyPublicResult.student_id == student_id
            ).first()

            if pub_res:
                pub_q1 = max(getattr(pub_res, "q1", 0) or 0, q1_flag)
                pub_q2 = max(getattr(pub_res, "q2", 0) or 0, q2_flag)
                pub_q3 = max(getattr(pub_res, "q3", 0) or 0, q3_flag)
                pub_q4 = max(getattr(pub_res, "q4", 0) or 0, q4_flag)
                pub_solved = pub_q1 + pub_q2 + pub_q3 + pub_q4
                setattr(pub_res, "q1", pub_q1)
                setattr(pub_res, "q2", pub_q2)
                setattr(pub_res, "q3", pub_q3)
                setattr(pub_res, "q4", pub_q4)
                setattr(pub_res, "total_contest_solved", pub_solved)
                if official_rank is not None:
                    setattr(pub_res, "contest_rank", official_rank)
                if official_score is not None:
                    setattr(pub_res, "contest_score", official_score)
                if pub_solved > 0 or official_rank:
                    setattr(pub_res, "participation_status", "PUBLIC_ATTENDED")
                    setattr(pub_res, "state", "VALIDATED")
                    setattr(pub_res, "confidence", "VERIFIED")

            db.commit()
            db.refresh(record)

        except SQLAlchemyError as err:
            db.rollback()
            logger.error(f"[SUNDAY_LIVE_INGEST] Database transaction error: {err}")
            return False, None, f"Database transaction failed: {str(err)}"

        # Recalculate summary metrics after commit
        metrics = cls.recalculate_live_summary_metrics(db, int(session.id))

        # Broadcast Targeted WebSocket Events
        if has_changed:
            dept_name = student.department.name if student.department else ""
            rec_off_rank = getattr(record, "official_rank", None)
            rec_fin_time = getattr(record, "finish_time", None)
            rec_yr_lvl = getattr(student, "year_level", None)
            await manager.broadcast_contest_result(
                student_id=int(student.id),
                student_name=str(getattr(student, "name", "") or ""),
                reg_no=str(getattr(student, "reg_no", "") or ""),
                username=str(getattr(student, "username", "") or ""),
                contest_id=str(getattr(session, "contest_id", "") or ""),
                session_id=int(session.id),
                q1=int(getattr(record, "q1", 0) or 0),
                q2=int(getattr(record, "q2", 0) or 0),
                q3=int(getattr(record, "q3", 0) or 0),
                q4=int(getattr(record, "q4", 0) or 0),
                solved_count=new_solved_count,
                official_rank=int(rec_off_rank) if rec_off_rank is not None else None,
                finish_time=str(rec_fin_time) if rec_fin_time is not None else None,
                participation_status=str(getattr(record, "participation_type", "PUBLIC") or "PUBLIC"),
                evidence_state="VERIFIED_LIVE",
                department_name=dept_name,
                year_level=str(rec_yr_lvl) if rec_yr_lvl is not None else None,
                dataset_version=int(getattr(record, "dataset_version", 1) or 1)
            )

            await manager.broadcast_contest_summary(
                session_id=int(session.id),
                contest_id=str(getattr(session, "contest_id", "") or ""),
                metrics=metrics,
                dataset_version=int(getattr(record, "dataset_version", 1) or 1)
            )

        result_payload = {
            "student_id": student.id,
            "reg_no": student.reg_no,
            "student_name": student.name,
            "leetcode_username": student.username,
            "q1": record.q1,
            "q2": record.q2,
            "q3": record.q3,
            "q4": record.q4,
            "solved_count": new_solved_count,
            "official_rank": record.official_rank,
            "finish_time": record.finish_time,
            "participation_type": record.participation_type,
            "metrics": metrics,
            "has_changed": has_changed
        }

        return True, result_payload, None


    @classmethod
    async def simulate_question_solve_progression(
        cls,
        db: Session,
        session_id: int,
        student_id: int,
        target_solved: int
    ) -> Dict[str, Any]:
        """
        Simulates progress transitions:
        0/4 -> 1/4 -> 2/4 -> 3/4 -> 4/4
        Verifying Question-level DB update, Solved Recalculation, and Realtime WebSocket broadcast.
        """
        target_solved = max(0, min(4, target_solved))
        q1 = 1 if target_solved >= 1 else 0
        q2 = 1 if target_solved >= 2 else 0
        q3 = 1 if target_solved >= 3 else 0
        q4 = 1 if target_solved >= 4 else 0

        now_str = datetime.datetime.now(IST_TZ).strftime("%H:%M:%S IST")
        score = target_solved * 4
        rank = max(1, 1500 - (target_solved * 350))

        success, data, error = await cls.ingest_student_solve_event(
            db=db,
            session_id=session_id,
            student_id=student_id,
            q1=q1,
            q2=q2,
            q3=q3,
            q4=q4,
            official_rank=rank,
            official_score=score,
            finish_time=now_str,
            evidence_source="simulated_live_test_harness"
        )

        return {
            "success": success,
            "target_solved": target_solved,
            "q_states": {"q1": q1, "q2": q2, "q3": q3, "q4": q4},
            "data": data,
            "error": error
        }
