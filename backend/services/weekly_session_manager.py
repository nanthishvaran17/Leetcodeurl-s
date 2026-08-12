import datetime
import hashlib
import json
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session
from backend.models import (
    WeeklySession, WeeklyPublicResult, WeeklyVirtualResult, 
    WeeklyContestErrorLog, OfficialWeeklySnapshot, Student
)
from backend.services.contest_discovery import discover_contest_metadata, get_current_ist_datetime
from backend.services.contest_merger import retry_failed_student_fetches, merge_contest_fetch_results
from backend.leetcode_client import fetch_leetcode_profile
from backend.logger import logger

def get_or_create_current_weekly_session(db: Session) -> WeeklySession:
    """
    Retrieves or creates the active/upcoming weekly contest session.
    Guarantees unique session per week using session_code constraint (e.g. WEEK-2026-08-16).
    """
    meta = discover_contest_metadata()
    session_code = meta["session_code"]
    
    session = db.query(WeeklySession).filter(WeeklySession.session_code == session_code).first()
    
    if not session:
        now_ist = get_current_ist_datetime()
        week_num = now_ist.isocalendar()[1]
        
        session = WeeklySession(
            academic_year="2026-27",
            week_number=week_num,
            session_code=session_code,
            session_date=meta["session_date"],
            contest_id=meta["contest_id"],
            contest_name=meta["contest_name"],
            start_time="08:00",
            end_time="09:30",
            status="SCHEDULED",
            total_students=273
        )
        db.add(session)
        db.commit()
        db.refresh(session)
        logger.info(f"Created new WeeklySession ID={session.id} for {session_code}")

    return session

async def trigger_start_snapshot_0800(db: Session, session_id: int):
    """
    Executed at 08:00 AM IST: Creates baseline student tracking records.
    Sets participation_status = PENDING for all students (nobody marked NOT ATTENDED yet).
    """
    session = db.query(WeeklySession).filter(WeeklySession.id == session_id).first()
    if not session:
        logger.error(f"WeeklySession ID {session_id} not found.")
        return

    session.status = "LIVE"
    session.baseline_snapshot_id = f"start_{session_id}"
    db.commit()

    students = db.query(Student).filter((Student.is_active == True) | (Student.is_active.is_(None))).all()
    session.total_students = len(students)
    db.commit()

    for student in students:
        existing_res = db.query(WeeklyPublicResult).filter(
            WeeklyPublicResult.session_id == session_id,
            WeeklyPublicResult.student_id == student.id
        ).first()

        if not existing_res:
            res = WeeklyPublicResult(
                session_id=session_id,
                student_id=student.id,
                reg_no=student.reg_no,
                name=student.name,
                dept=student.department.code if student.department else "CSE",
                year=student.year_level or "III",
                participation_status="PENDING",
                q1=0, q2=0, q3=0, q4=0,
                total_contest_solved=0,
                fetch_status="PENDING"
            )
            db.add(res)

    db.commit()
    logger.info(f"08:00 AM Start Snapshot initialized for Session ID {session_id} with {len(students)} students.")

async def run_live_polling_cycle(db: Session, session_id: int):
    """
    Executed repeatedly during 08:00–09:30 AM IST.
    Polls live contest participation with rate limiting and exponential backoff retry.
    """
    session = db.query(WeeklySession).filter(WeeklySession.id == session_id).first()
    if not session or session.status not in ("LIVE", "SCHEDULED"):
        return

    if session.status == "SCHEDULED":
        session.status = "LIVE"
        db.commit()

    await retry_failed_student_fetches(db, session_id)

async def trigger_final_snapshot_0930(db: Session, session_id: int) -> OfficialWeeklySnapshot:
    """
    Executed at 09:30 AM IST: Finalizes and locks official weekly session.
    1. Runs final retry sweep for unresolved records.
    2. Classifies unresolved records: PUBLIC_ATTENDED, PUBLIC_NOT_ATTENDED, or DATA_ERROR.
    3. Creates immutable OfficialWeeklySnapshot locked snapshot.
    4. Sets status = FINALIZED.
    """
    session = db.query(WeeklySession).filter(WeeklySession.id == session_id).first()
    if not session:
        raise ValueError(f"Session ID {session_id} not found.")

    if session.status == "FINALIZED":
        logger.info(f"Session ID {session_id} is already FINALIZED.")
        return db.query(OfficialWeeklySnapshot).filter(OfficialWeeklySnapshot.session_id == session_id).first()

    session.status = "FINALIZING"
    db.commit()

    # Step 1: Final Retry Sweep
    await retry_failed_student_fetches(db, session_id)

    # Step 2: Resolve Final Statuses
    public_results = db.query(WeeklyPublicResult).filter(WeeklyPublicResult.session_id == session_id).all()
    
    official_attended = 0
    not_attended = 0
    data_errors = 0

    for r in public_results:
        if r.fetch_status == "SUCCESS":
            if r.participation_status in ("PUBLIC_ATTENDED", "ATTENDED"):
                r.participation_status = "PUBLIC_ATTENDED"
                official_attended += 1
            else:
                r.participation_status = "PUBLIC_NOT_ATTENDED"
                r.q1 = r.q2 = r.q3 = r.q4 = r.total_contest_solved = 0
                not_attended += 1
        elif r.fetch_status == "FETCH_ERROR":
            r.participation_status = "DATA_ERROR"
            data_errors += 1
        else:
            r.participation_status = "PUBLIC_NOT_ATTENDED"
            r.q1 = r.q2 = r.q3 = r.q4 = r.total_contest_solved = 0
            not_attended += 1

    virtual_results = db.query(WeeklyVirtualResult).filter(WeeklyVirtualResult.session_id == session_id).all()
    virtual_count = len(virtual_results)

    session.official_participants = official_attended
    session.virtual_participants = virtual_count
    session.not_participated = not_attended
    session.failed_verification = data_errors
    session.completed_at = datetime.datetime.utcnow()
    session.finalized_at = datetime.datetime.utcnow()

    # Step 3: Build Immutable Snapshot Dataset
    matrix_rows = []
    for idx, r in enumerate(public_results, start=1):
        matrix_rows.append({
            "s_no": idx,
            "reg_no": r.reg_no,
            "name": r.name,
            "dept": r.dept,
            "year": r.year,
            "participation_status": r.participation_status,
            "q1": r.q1, "q2": r.q2, "q3": r.q3, "q4": r.q4,
            "total_solved": r.total_contest_solved,
            "score": r.contest_score,
            "contest_rank": r.contest_rank,
            "contest_rating": r.contest_rating,
            "fetch_status": r.fetch_status,
            "error_reason": r.error_reason
        })

    snapshot_data = {
        "sessionId": session.id,
        "sessionCode": session.session_code,
        "contestId": session.contest_id,
        "contestName": session.contest_name,
        "sessionDate": session.session_date,
        "finalizedAt": session.finalized_at.isoformat(),
        "metrics": {
            "totalStudents": session.total_students,
            "officialAttended": official_attended,
            "notAttended": not_attended,
            "virtualAttended": virtual_count,
            "dataErrors": data_errors,
            "participationRate": round((official_attended / max(session.total_students, 1)) * 100, 1)
        },
        "rows": matrix_rows
    }

    data_json_str = json.dumps(snapshot_data, sort_keys=True)
    dataset_hash = hashlib.sha256(data_json_str.encode('utf-8')).hexdigest()
    session.dataset_hash = dataset_hash

    snapshot = OfficialWeeklySnapshot(
        session_id=session.id,
        contest_id=session.contest_id or "weekly-contest",
        contest_name=session.contest_name,
        contest_date=session.session_date,
        finalized_at=session.finalized_at,
        dataset=snapshot_data,
        dataset_hash=dataset_hash,
        student_count=session.total_students,
        error_count=data_errors
    )
    db.add(snapshot)

    session.status = "FINALIZED"
    db.commit()
    logger.info(f"09:30 AM Official Weekly Snapshot locked for Session ID {session_id} (Hash: {dataset_hash[:10]})")
    return snapshot

def seed_institutional_historical_sessions(db: Session):
    """
    Seeds Last Week (09.08.2026 - Weekly Contest 469), Current Week (16.08.2026 - Weekly Contest 470),
    and Upcoming Week (23.08.2026 - Weekly Contest 471) sessions with 273 student matrix records.
    """
    students = db.query(Student).filter((Student.is_active == True) | (Student.is_active.is_(None))).all()
    if not students or len(students) < 100:
        try:
            from backend.seed import seed_database
            seed_database(db)
            students = db.query(Student).filter((Student.is_active == True) | (Student.is_active.is_(None))).all()
        except Exception as _se:
            logger.warning(f"Student seed warning in session manager: {_se}")

    weeks_config = [
        {"code": "WEEK-2026-08-09", "date": "09.08.2026", "id": "weekly-contest-469", "name": "Weekly Contest 469 (LAST WEEK)", "status": "FINALIZED"},
        {"code": "WEEK-2026-08-16", "date": "16.08.2026", "id": "weekly-contest-470", "name": "Weekly Contest 470 (CURRENT WEEK)", "status": "LIVE"},
        {"code": "WEEK-2026-08-23", "date": "23.08.2026", "id": "weekly-contest-471", "name": "Weekly Contest 471 (UPCOMING WEEK)", "status": "SCHEDULED"}
    ]

    for w in weeks_config:
        sess = db.query(WeeklySession).filter(WeeklySession.session_code == w["code"]).first()
        if not sess:
            sess = WeeklySession(
                academic_year="2026-27",
                week_number=32 if "09" in w["date"] else 33 if "16" in w["date"] else 34,
                session_code=w["code"],
                session_date=w["date"],
                contest_id=w["id"],
                contest_name=w["name"],
                start_time="08:00",
                end_time="09:30",
                status=w["status"],
                total_students=len(students)
            )
            db.add(sess)
            db.commit()
            db.refresh(sess)

        # Seed student public results for this session if empty
        existing_res_count = db.query(WeeklyPublicResult).filter(WeeklyPublicResult.session_id == sess.id).count()
        if existing_res_count == 0:
            official_cnt = 0
            not_cnt = 0

            for idx, s in enumerate(students, start=1):
                st = s.stats
                is_verified = st and st.validation_status == "verified"
                has_solved = is_verified and st.total_solved is not None and st.total_solved > 0

                # Deterministic solved distribution for Last Week / Current Week
                if w["status"] == "FINALIZED":
                    if has_solved and (idx % 3 != 0): # ~66% attended
                        p_status = "PUBLIC_ATTENDED"
                        q1 = 1 if (idx % 2 == 0 or idx % 3 == 0) else 0
                        q2 = 1 if (idx % 4 == 0 or idx % 5 == 0) else 0
                        q3 = 1 if (idx % 7 == 0) else 0
                        q4 = 1 if (idx % 11 == 0) else 0
                        tot = q1 + q2 + q3 + q4
                        score = q1*3 + q2*4 + q3*5 + q4*6
                        rank_val = 1200 + (idx * 37)
                        rating_val = round(1500.0 + (st.total_solved * 0.8), 1) if st and st.total_solved else 1520.0
                        official_cnt += 1
                    else:
                        p_status = "PUBLIC_NOT_ATTENDED"
                        q1 = q2 = q3 = q4 = tot = score = 0
                        rank_val = None
                        rating_val = None
                        not_cnt += 1
                    f_status = "SUCCESS"
                else: # LIVE or SCHEDULED
                    if has_solved and (idx % 4 == 0):
                        p_status = "PUBLIC_ATTENDED"
                        q1 = 1
                        q2 = 1 if idx % 8 == 0 else 0
                        q3 = q4 = 0
                        tot = q1 + q2
                        score = q1*3 + q2*4
                        rank_val = 2400 + (idx * 50)
                        rating_val = 1550.0
                        official_cnt += 1
                    else:
                        p_status = "PENDING"
                        q1 = q2 = q3 = q4 = tot = score = 0
                        rank_val = None
                        rating_val = None
                        not_cnt += 1
                    f_status = "PENDING"

                res = WeeklyPublicResult(
                    session_id=sess.id,
                    student_id=s.id,
                    reg_no=s.reg_no,
                    name=s.name,
                    dept=s.department.code if s.department else "CSE",
                    year=s.year_level or "III",
                    participation_status=p_status,
                    q1=q1, q2=q2, q3=q3, q4=q4,
                    total_contest_solved=tot,
                    contest_score=score,
                    contest_rank=rank_val,
                    contest_rating=rating_val,
                    fetch_status=f_status
                )
                db.add(res)

            sess.official_participants = official_cnt
            sess.not_participated = not_cnt
            db.commit()

async def resume_active_weekly_session(db: Session):
    """
    Idempotent Server Restart Recovery Engine.
    Executes on application startup to safely inspect and resume active weekly session state.
    Prevents duplicate sessions or overwriting finalized snapshots.
    """
    seed_institutional_historical_sessions(db)
    session = get_or_create_current_weekly_session(db)
    now_ist = get_current_ist_datetime()
    time_str = now_ist.strftime("%H:%M")

    logger.info(f"Checking WeeklySession ID {session.id} ({session.session_code}) status: '{session.status}' at IST {time_str}")

    if session.status == "SCHEDULED" and time_str >= "08:00":
        logger.info("Resuming 08:00 AM Start Snapshot...")
        await trigger_start_snapshot_0800(db, session.id)

    elif session.status == "LIVE" and time_str >= "09:30":
        logger.info("Resuming 09:30 AM Finalization...")
        await trigger_final_snapshot_0930(db, session.id)

    elif session.status == "FINALIZING":
        logger.info("Completing interrupted 09:30 AM Finalization...")
        await trigger_final_snapshot_0930(db, session.id)

    elif session.status in ("FINALIZED", "ARCHIVED"):
        logger.info(f"Session {session.session_code} is locked ({session.status}). No recovery action needed.")

