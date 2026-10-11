import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.database import SessionLocal
from backend.models import Student, WeeklySession, WeeklyPublicResult, PreviousWeekParticipationRecord
from backend.services.canonical_contest_engine import invalidate_canonical_cache
from backend.cache import cache

def fix_contest_523_records():
    print("Applying Authoritative Ground-Truth Corrections for Weekly Contest 523...")
    db = SessionLocal()
    try:
        session = db.query(WeeklySession).filter(
            (WeeklySession.id == 14) | (WeeklySession.contest_name.like('%523%'))
        ).first()
        if not session:
            print("Session 523 not found!")
            return

        session_id = session.id
        print(f"Target Session: ID {session_id} ({session.contest_name})")

        # Specific ground truth overrides
        overrides = {
            # 1. SRIDHAR S (732224CCL04) - Solved 2 problems
            "732224CCL04": {
                "q1": 1, "q2": 1, "q3": 0, "q4": 0,
                "total_solved": 2, "score": 7, "status": "PUBLIC"
            },
            # 2. SAKTHI S (732224CC044) - Solved 1 problem
            "732224CC044": {
                "q1": 1, "q2": 0, "q3": 0, "q4": 0,
                "total_solved": 1, "score": 3, "status": "PUBLIC"
            },
            # 3. DHARUNRAJ K P (732224CC008) - Solved 4 problems
            "732224CC008": {
                "q1": 1, "q2": 1, "q3": 1, "q4": 1,
                "total_solved": 4, "score": 18, "status": "PUBLIC"
            },
            # 4. NANTHISH S (732224CC031) - Solved 1 problem
            "732224CC031": {
                "q1": 1, "q2": 0, "q3": 0, "q4": 0,
                "total_solved": 1, "score": 3, "status": "PUBLIC"
            },
            # 5. LAKSANA S (732224CC023) - Solved 1 problem
            "732224CC023": {
                "q1": 1, "q2": 0, "q3": 0, "q4": 0,
                "total_solved": 1, "score": 3, "status": "PUBLIC"
            }
        }

        for reg_no, data in overrides.items():
            student = db.query(Student).filter(Student.reg_no == reg_no).first()
            if not student:
                print(f"Student {reg_no} not found!")
                continue

            # Update WeeklyPublicResult
            wpr = db.query(WeeklyPublicResult).filter(
                WeeklyPublicResult.session_id == session_id,
                WeeklyPublicResult.student_id == student.id
            ).first()

            if not wpr:
                wpr = WeeklyPublicResult(
                    session_id=session_id,
                    student_id=student.id,
                    reg_no=student.reg_no,
                    name=student.name,
                    dept=student.department.code if student.department else "CSE(CS)",
                    year=student.year_level or "III"
                )
                db.add(wpr)

            wpr.participation_status = data["status"]
            wpr.q1 = data["q1"]
            wpr.q2 = data["q2"]
            wpr.q3 = data["q3"]
            wpr.q4 = data["q4"]
            wpr.total_contest_solved = data["total_solved"]
            wpr.contest_score = data["score"]
            wpr.fetch_status = "SUCCESS"
            wpr.confidence = "VERIFIED"

            # Update PreviousWeekParticipationRecord
            pwpr = db.query(PreviousWeekParticipationRecord).filter(
                PreviousWeekParticipationRecord.session_id == session_id,
                PreviousWeekParticipationRecord.student_id == student.id
            ).first()

            if not pwpr:
                pwpr = PreviousWeekParticipationRecord(
                    session_id=session_id,
                    contest_id=session.contest_id or "weekly-contest-523",
                    contest_slug=(session.contest_id or "weekly-contest-523").lower(),
                    contest_title=session.contest_name or "Weekly Contest 523",
                    student_id=student.id,
                    leetcode_username=student.username,
                    participation_type=data["status"],
                    q1=data["q1"],
                    q2=data["q2"],
                    q3=data["q3"],
                    q4=data["q4"],
                    problems_solved=data["total_solved"],
                    official_score=data["score"],
                    source="verified_hall_telemetry",
                    verification_status="VERIFIED",
                    dataset_version=1,
                    is_active_version=True
                )
                db.add(pwpr)
            else:
                pwpr.participation_type = data["status"]
                pwpr.q1 = data["q1"]
                pwpr.q2 = data["q2"]
                pwpr.q3 = data["q3"]
                pwpr.q4 = data["q4"]
                pwpr.problems_solved = data["total_solved"]
                pwpr.official_score = data["score"]
                pwpr.verification_status = "VERIFIED"

            print(f"Updated {reg_no} ({student.name}): Solved={data['total_solved']} Score={data['score']} Status={data['status']}")

        # Recount total PUBLIC students in Session 14
        total_public = db.query(WeeklyPublicResult).filter(
            WeeklyPublicResult.session_id == session_id,
            WeeklyPublicResult.participation_status == "PUBLIC"
        ).count()

        total_students = db.query(Student).filter(Student.is_active == True).count()

        session.official_participants = total_public
        session.not_participated = max(0, total_students - total_public)
        session.status = "FINALIZED"
        session.finalized = True

        db.commit()
        print(f"\nFinalized Session 14: Total Public = {total_public}, Total Students = {total_students}")

        invalidate_canonical_cache(session_id)
        cache.invalidate_tag("contests")
        cache.clear()
        print("All caches invalidated successfully.")

    finally:
        db.close()

if __name__ == "__main__":
    fix_contest_523_records()
