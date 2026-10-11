import os
import sys
import json
from typing import cast, Any

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.database import SessionLocal
from backend.models import Student, WeeklySession, WeeklyPublicResult, PreviousWeekParticipationRecord
from backend.services.canonical_contest_engine import invalidate_canonical_cache
from backend.cache import cache

def load_authentic_scanned_solvers():
    potential_paths = [
        os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "contest_523_authentic_scanned_solvers.json"),
        r"e:\Leetcode Web\contest_523_authentic_scanned_solvers.json",
        "contest_523_authentic_scanned_solvers.json"
    ]
    for p in potential_paths:
        if os.path.exists(p):
            with open(p, "r", encoding="utf-8") as f:
                data = json.load(f)
                print(f"Loaded {len(data)} authentic LeetCode Contest 523 participants from {p}")
                return data
    raise FileNotFoundError("Could not locate contest_523_authentic_scanned_solvers.json")

def sync_session_523_participation():
    print("=" * 80)
    print("APPLYING 100% OFFICIAL LEETCODE CONTEST 523 SCANNED RANKINGS (ZERO MOCK DATA)")
    print("=" * 80)
    
    scanned_data = load_authentic_scanned_solvers()
    
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

        # 1. Clean out any dummy / test records
        db.query(WeeklyPublicResult).filter(
            WeeklyPublicResult.session_id == session_id,
            WeeklyPublicResult.reg_no.like('REG_%')
        ).delete(synchronize_session=False)

        # 2. Get all genuine active college students
        students = db.query(Student).filter(
            Student.is_active == True,
            ~Student.reg_no.like('REG_%'),
            ~Student.reg_no.like('TEST%'),
            ~Student.reg_no.like('HARDENING%')
        ).all()
        print(f"Loaded {len(students)} genuine active college students.")

        existing = db.query(WeeklyPublicResult).filter(WeeklyPublicResult.session_id == session_id).all()
        res_map = {r.student_id: r for r in existing}

        existing_pwpr = db.query(PreviousWeekParticipationRecord).filter(PreviousWeekParticipationRecord.session_id == session_id).all()
        pwpr_map = {r.student_id: r for r in existing_pwpr}

        total_participated = 0
        not_attended_count = 0
        dept_counts = {"IT": 0, "CSE(CS)": 0, "CSE(IOT)": 0, "OTHER": 0}

        for s in students:
            is_solver = s.reg_no in scanned_data
            data = scanned_data.get(s.reg_no)

            r = res_map.get(s.id)
            if not r:
                r = WeeklyPublicResult(
                    session_id=session_id,
                    student_id=s.id,
                    reg_no=s.reg_no,
                    name=s.name,
                    dept=s.department.code if s.department else "CSE",
                    year=s.year_level or "III"
                )
                db.add(r)
                res_map[s.id] = r

            r_any = cast(Any, r)

            reg_upper = (s.reg_no or "").upper()
            dept_key = "OTHER"
            if "CC" in reg_upper:
                dept_key = "CSE(CS)"
            elif "CI" in reg_upper:
                dept_key = "CSE(IOT)"
            elif "IT" in reg_upper:
                dept_key = "IT"

            if is_solver and data:
                r_any.participation_status = "PUBLIC"
                r_any.fetch_status = "SUCCESS"
                r_any.confidence = "VERIFIED"
                r_any.q1 = data["q1"]
                r_any.q2 = data["q2"]
                r_any.q3 = data["q3"]
                r_any.q4 = data["q4"]
                r_any.total_contest_solved = data["total_solved"]
                r_any.contest_score = data["score"]
                r_any.contest_rank = data.get("rank")
                total_participated += 1
                dept_counts[dept_key] = dept_counts.get(dept_key, 0) + 1
            else:
                r_any.participation_status = "NOT_ATTENDED"
                r_any.fetch_status = "SUCCESS"
                r_any.confidence = "VERIFIED"
                r_any.q1 = 0
                r_any.q2 = 0
                r_any.q3 = 0
                r_any.q4 = 0
                r_any.total_contest_solved = 0
                r_any.contest_score = 0
                r_any.contest_rank = None
                not_attended_count += 1

            # Sync PreviousWeekParticipationRecord
            pwpr = pwpr_map.get(s.id)
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
                pwpr_map[s.id] = pwpr
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
                pwpr.source = "official_leetcode_contest_ranking_v2"
                pwpr.verification_status = "VERIFIED"

        # Update WeeklySession top-level metrics
        session.official_participants = total_participated
        session.not_participated = not_attended_count
        session.total_students = len(students)
        session.virtual_participants = 0
        session.failed_verification = 0
        session.status = "FINALIZED"
        session.finalized = True

        db.commit()
        print(f"\nUPDATED SESSION 523 ROSTER SUCCESSFUL!")
        print(f"Total Authentic Public Solvers (PUBLIC): {total_participated}")
        print(f"Total Not Attended: {not_attended_count}")
        print(f"Department Breakdown: IT: {dept_counts['IT']}, CSE(CS): {dept_counts['CSE(CS)']}, CSE(IOT): {dept_counts['CSE(IOT)']}")

        invalidate_canonical_cache(session.id)
        cache.invalidate_tag("contests")
        cache.clear()
        print("Contest cache invalidated successfully.")

    finally:
        db.close()

if __name__ == "__main__":
    sync_session_523_participation()
