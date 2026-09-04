import datetime
from zoneinfo import ZoneInfo
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session

from backend.logger import logger
from backend.models import (
    StudentContestParticipation, 
    AuditLogRecord, 
    ContestConfig,
    AttendanceSnapshot,
    PostContestActivityRecord
)

IST = ZoneInfo("Asia/Kolkata")
UTC = ZoneInfo("UTC")

class ContestActivityType:
    IN_CONTEST = "IN_CONTEST"
    POST_CONTEST = "POST_CONTEST"
    VIRTUAL = "VIRTUAL"

class OfficialAttendanceState:
    ATTENDED = "ATTENDED"
    NOT_ATTENDED = "NOT_ATTENDED"
    UNKNOWN = "UNKNOWN"

class ContestWindowEngine:
    """
    10/10+ Production Contest Window Engine enforcing Asia/Kolkata server time.
    Strict boundary precision:
      - activity_time <= contest_end -> IN_CONTEST
      - activity_time > contest_end  -> POST_CONTEST
    Attendance Freeze at 09:35 AM IST writes immutable AttendanceSnapshot.
    """

    @staticmethod
    def get_server_ist_time() -> datetime.datetime:
        """Returns the current server time in Asia/Kolkata timezone."""
        return datetime.datetime.now(tz=IST)

    @classmethod
    def get_or_create_contest_config(
        cls, 
        db: Session, 
        contest_id: str, 
        contest_date_str: Optional[str] = None
    ) -> ContestConfig:
        """Retrieves or initializes configurable contest timing parameters."""
        config = db.query(ContestConfig).filter(ContestConfig.contest_id == contest_id).first()
        if not config:
            now_ist = cls.get_server_ist_time()
            if contest_date_str:
                try:
                    c_date = datetime.datetime.strptime(contest_date_str, "%Y-%m-%d").date()
                except ValueError:
                    c_date = now_ist.date()
            else:
                c_date = now_ist.date()

            start_dt = datetime.datetime(c_date.year, c_date.month, c_date.day, 8, 0, 0, tzinfo=IST)
            end_dt = datetime.datetime(c_date.year, c_date.month, c_date.day, 9, 30, 0, tzinfo=IST)
            final_sync_dt = datetime.datetime(c_date.year, c_date.month, c_date.day, 9, 35, 0, tzinfo=IST)

            config = ContestConfig(
                contest_id=contest_id,
                contest_name=f"Weekly Contest {contest_id}",
                contest_start_time=start_dt,
                contest_end_time=end_dt,
                final_sync_end_time=final_sync_dt,
                timezone="Asia/Kolkata",
                is_frozen=False,
                algorithm_version="2.0.0"
            )
            db.add(config)
            db.commit()
            db.refresh(config)

        return config

    @classmethod
    def classify_activity_time(
        cls, 
        activity_time: datetime.datetime, 
        contest_end_time: Optional[datetime.datetime] = None
    ) -> str:
        """
        Boundary precision activity classification:
          - activity_time <= contest_end -> IN_CONTEST
          - activity_time > contest_end  -> POST_CONTEST
        """
        if activity_time.tzinfo is None:
            activity_ist = activity_time.replace(tzinfo=UTC).astimezone(IST)
        else:
            activity_ist = activity_time.astimezone(IST)

        if contest_end_time:
            if contest_end_time.tzinfo is None:
                c_end_ist = contest_end_time.replace(tzinfo=UTC).astimezone(IST)
            else:
                c_end_ist = contest_end_time.astimezone(IST)
        else:
            c_end_ist = activity_ist.replace(hour=9, minute=30, second=0, microsecond=0)

        c_start_ist = c_end_ist.replace(hour=8, minute=0, second=0, microsecond=0)

        if c_start_ist <= activity_ist <= c_end_ist:
            return ContestActivityType.IN_CONTEST
        else:
            return ContestActivityType.POST_CONTEST

    @classmethod
    def process_and_freeze_attendance(
        cls, 
        db: Session, 
        contest_id: str, 
        participations_data: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Executes final attendance calculation at 09:35 AM IST, FREEZES the record,
        and writes immutable AttendanceSnapshot entries.
        """
        now_ist = cls.get_server_ist_time()
        config = cls.get_or_create_contest_config(db, contest_id)
        frozen_records = []

        for p_data in participations_data:
            student_id = p_data.get("student_id")
            score_display = p_data.get("score_display")
            questions_solved = p_data.get("questions_solved", 0)
            in_contest_solved = p_data.get("in_contest_solved", 0)
            is_unknown = p_data.get("is_unknown", False)

            # Determine Official Attendance State
            if is_unknown or score_display in (None, "UNKNOWN", "SYNC_PENDING"):
                attendance_state = OfficialAttendanceState.UNKNOWN
            elif in_contest_solved > 0 or (questions_solved > 0 and p_data.get("solved_in_window", True)):
                attendance_state = OfficialAttendanceState.ATTENDED
            elif score_display and ("NOT ATTENDED" in str(score_display).upper() or str(score_display).strip() in ("0", "0 / 4", "0/4")):
                attendance_state = OfficialAttendanceState.NOT_ATTENDED
            else:
                attendance_state = OfficialAttendanceState.UNKNOWN

            # Upsert into database
            part_record = db.query(StudentContestParticipation).filter(
                StudentContestParticipation.student_id == student_id,
                StudentContestParticipation.contest_id == contest_id,
                StudentContestParticipation.participation_mode == p_data.get("participation_mode", "PUBLIC")
            ).first()

            if part_record:
                # If already frozen, DO NOT MODIFY official attendance
                if getattr(part_record, "is_frozen", False):
                    if p_data.get("is_post_contest", False):
                        post_solves = getattr(part_record, "post_contest_solves_count", 0) or 0
                        setattr(part_record, "post_contest_solves_count", post_solves + p_data.get("new_solves", 0))
                else:
                    part_record.official_attendance_state = attendance_state
                    part_record.is_frozen = True
                    part_record.frozen_at = now_ist
                    part_record.score_display = score_display
                    part_record.questions_solved = in_contest_solved
            else:
                new_record = StudentContestParticipation(
                    student_id=student_id,
                    contest_id=contest_id,
                    contest_name=p_data.get("contest_name", f"Weekly Contest {contest_id}"),
                    participation_mode=p_data.get("participation_mode", "PUBLIC"),
                    questions_solved=in_contest_solved,
                    score_display=score_display,
                    source=p_data.get("source", "official_sync"),
                    official_attendance_state=attendance_state,
                    is_frozen=True,
                    frozen_at=now_ist
                )
                db.add(new_record)

            # Create Immutable Attendance Snapshot
            student_obj = db.query(StudentContestParticipation).filter_by(student_id=student_id).first()
            people_id_val = p_data.get("people_id", f"STUDENT_{student_id}")
            username_val = p_data.get("leetcode_username", f"user_{student_id}")

            existing_snapshot = db.query(AttendanceSnapshot).filter(
                AttendanceSnapshot.contest_id == contest_id,
                AttendanceSnapshot.people_id == people_id_val,
                AttendanceSnapshot.leetcode_username == username_val
            ).first()

            if not existing_snapshot:
                snapshot = AttendanceSnapshot(
                    contest_id=contest_id,
                    people_id=people_id_val,
                    student_id=student_id,
                    leetcode_username=username_val,
                    official_attendance_state=attendance_state,
                    source=p_data.get("source", "official_contest_sync"),
                    calculated_at=now_ist,
                    frozen_at=now_ist,
                    algorithm_version="2.0.0"
                )
                db.add(snapshot)

            frozen_records.append({
                "student_id": student_id,
                "attendance_state": attendance_state,
                "is_frozen": True
            })

        # Update ContestConfig is_frozen status
        config.is_frozen = True
        config.attendance_frozen_at = now_ist

        # Record Audit Log
        audit_entry = AuditLogRecord(
            event_type="ATTENDANCE_FROZEN_0935",
            contest_id=contest_id,
            details={"frozen_records_count": len(frozen_records), "timestamp_ist": now_ist.isoformat()},
            created_by="CONTEST_WINDOW_ENGINE"
        )
        db.add(audit_entry)
        db.commit()

        logger.info(f"[CONTEST_ENGINE] Attendance calculated, frozen, and snapshotted for contest {contest_id} at {now_ist.strftime('%I:%M:%S %p IST')}.")
        return {"contest_id": contest_id, "frozen_count": len(frozen_records), "records": frozen_records}

    @classmethod
    def log_post_contest_activity(
        cls, 
        db: Session, 
        student_id: int, 
        people_id: str, 
        contest_id: str, 
        account_id: str, 
        submission_time: datetime.datetime, 
        problem_slug: Optional[str] = None, 
        result: Optional[str] = "ACCEPTED"
    ) -> PostContestActivityRecord:
        """
        Stores post-contest solves in PostContestActivityRecord.
        Guarantees that official frozen attendance is NEVER modified.
        """
        now_ist = cls.get_server_ist_time()
        sub_id = f"SUB-{account_id}-{contest_id}-{int(submission_time.timestamp())}"

        existing = db.query(PostContestActivityRecord).filter_by(submission_id=sub_id).first()
        if existing:
            return existing

        activity = PostContestActivityRecord(
            submission_id=sub_id,
            student_id=student_id,
            people_id=people_id,
            contest_id=contest_id,
            account_id=account_id,
            submission_time=submission_time,
            activity_type=ContestActivityType.POST_CONTEST,
            problem_slug=problem_slug,
            result=result,
            source="leetcode_post_sync",
            server_received_at=now_ist
        )
        db.add(activity)
        db.commit()
        db.refresh(activity)
        return activity
