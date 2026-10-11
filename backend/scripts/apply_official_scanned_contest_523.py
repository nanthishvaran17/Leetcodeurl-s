import json
import sys
import os

sys.path.insert(0, r"e:\Leetcode Web")
from backend.database import SessionLocal
from backend.models import Student, WeeklySession, WeeklyPublicResult, PreviousWeekParticipationRecord
from backend.services.canonical_contest_engine import invalidate_canonical_cache
from backend.cache import cache

def apply_official_scanned_results():
    print("=" * 80)
    print("APPLYING 100% OFFICIAL LEETCODE CONTEST 523 SCANNED RANKINGS TO DATABASE")
    print("=" * 80)

    with open("contest_523_authentic_scanned_solvers.json", "r") as f:
        scanned_data = json.load(f)

    print(f"Loaded {len(scanned_data)} official LeetCode Contest 523 participants.")

    db = SessionLocal()
    try:
        session = db.query(WeeklySession).filter(
            (WeeklySession.id == 14) | (WeeklySession.contest_name.like('%523%'))
        ).first()
        if not session:
            print("Session 14 (Weekly Contest 523) not found!")
            return

        session_id = session.id
        print(f"Target Session: ID {session_id} ({session.contest_name})")

        # 1. Purge dummy test records (REG_%) from Session 14
        db.query(WeeklyPublicResult).filter(
            WeeklyPublicResult.session_id == session_id,
            WeeklyPublicResult.reg_no.like('REG_%')
        ).delete(synchronize_session=False)

        db.query(PreviousWeekParticipationRecord).filter(
            PreviousWeekParticipationRecord.session_id == session_id,
            PreviousWeekParticipationRecord.student_id.in_(
                db.query(Student.id).filter(Student.reg_no.like('REG_%'))
            )
        ).delete(synchronize_session=False)

        # 2. Get all genuine active students
        students = db.query(Student).filter(
            Student.is_active == True,
            ~Student.reg_no.like('REG_%')
        ).all()
        print(f"Loaded {len(students)} active college students.")

        existing_wpr = {r.student_id: r for r in db.query(WeeklyPublicResult).filter(WeeklyPublicResult.session_id == session_id).all()}
        existing_pwpr = {r.student_id: r for r in db.query(PreviousWeekParticipationRecord).filter(PreviousWeekParticipationRecord.session_id == session_id).all()}

        public_count = 0
        not_attended_count = 0

        for s in students:
            is_solver = s.reg_no in scanned_data
            data = scanned_data.get(s.reg_no)

            # Update WeeklyPublicResult
            wpr = existing_wpr.get(s.id)
            if not wpr:
                wpr = WeeklyPublicResult(
                    session_id=session_id,
                    student_id=s.id,
                    reg_no=s.reg_no,
                    name=s.name,
                    dept=s.department.code if s.department else "CSE",
                    year=s.year_level or "III"
                )
                db.add(wpr)

            if is_solver and data:
                wpr.participation_status = "PUBLIC"
                wpr.fetch_status = "SUCCESS"
                wpr.confidence = "VERIFIED"
                wpr.q1 = data["q1"]
                wpr.q2 = data["q2"]
                wpr.q3 = data["q3"]
                wpr.q4 = data["q4"]
                wpr.total_contest_solved = data["total_solved"]
                wpr.contest_score = data["score"]
                wpr.contest_rank = data.get("rank")
                public_count += 1
            else:
                wpr.participation_status = "NOT_ATTENDED"
                wpr.fetch_status = "SUCCESS"
                wpr.confidence = "VERIFIED"
                wpr.q1 = 0
                wpr.q2 = 0
                wpr.q3 = 0
                wpr.q4 = 0
                wpr.total_contest_solved = 0
                wpr.contest_score = 0
                wpr.contest_rank = None
                not_attended_count += 1

            # Update PreviousWeekParticipationRecord
            pwpr = existing_pwpr.get(s.id)
            if not pwpr:
                pwpr = PreviousWeekParticipationRecord(
                    session_id=session_id,
                    contest_id=session.contest_id or "weekly-contest-523",
                    contest_slug="weekly-contest-523",
                    contest_title=session.contest_name or "Weekly Contest 523",
                    student_id=s.id,
                    leetcode_username=s.username,
                    participation_type="PUBLIC" if is_solver else "NOT_ATTENDED",
                    q1=data["q1"] if (is_solver and data) else 0,
                    q2=data["q2"] if (is_solver and data) else 0,
                    q3=data["q3"] if (is_solver and data) else 0,
                    q4=data["q4"] if (is_solver and data) else 0,
                    problems_solved=data["total_solved"] if (is_solver and data) else 0,
                    official_score=data["score"] if (is_solver and data) else 0,
                    official_rank=data.get("rank") if (is_solver and data) else None,
                    finish_time=str(data.get("finish_time")) if (is_solver and data) else None,
                    q1_observed_seconds=data.get("q1_secs") if (is_solver and data) else None,
                    q2_observed_seconds=data.get("q2_secs") if (is_solver and data) else None,
                    q3_observed_seconds=data.get("q3_secs") if (is_solver and data) else None,
                    q4_observed_seconds=data.get("q4_secs") if (is_solver and data) else None,
                    source="official_leetcode_contest_ranking_v2",
                    verification_status="VERIFIED",
                    dataset_version=1,
                    is_active_version=True
                )
                db.add(pwpr)
            else:
                pwpr.participation_type = "PUBLIC" if is_solver else "NOT_ATTENDED"
                pwpr.q1 = data["q1"] if (is_solver and data) else 0
                pwpr.q2 = data["q2"] if (is_solver and data) else 0
                pwpr.q3 = data["q3"] if (is_solver and data) else 0
                pwpr.q4 = data["q4"] if (is_solver and data) else 0
                pwpr.problems_solved = data["total_solved"] if (is_solver and data) else 0
                pwpr.official_score = data["score"] if (is_solver and data) else 0
                pwpr.official_rank = data.get("rank") if (is_solver and data) else None
                pwpr.finish_time = str(data.get("finish_time")) if (is_solver and data) else None
                if is_solver and data:
                    pwpr.q1_observed_seconds = data.get("q1_secs")
                    pwpr.q2_observed_seconds = data.get("q2_secs")
                    pwpr.q3_observed_seconds = data.get("q3_secs")
                    pwpr.q4_observed_seconds = data.get("q4_secs")

        session.official_participants = public_count
        session.not_participated = not_attended_count
        session.virtual_participants = 0
        session.status = "FINALIZED"
        session.finalized = True

        db.commit()
        print(f"\nDATABASE UPDATE COMPLETE!")
        print(f"Total Authentic Public Solvers in LeetCode: {public_count}")
        print(f"Total Not Attended: {not_attended_count}")
        print(f"Total Roster: {len(students)}")

        invalidate_canonical_cache(session_id)
        cache.invalidate_tag("contests")
        cache.clear()
        print("All caches invalidated successfully.")

    finally:
        db.close()

if __name__ == "__main__":
    apply_official_scanned_results()
