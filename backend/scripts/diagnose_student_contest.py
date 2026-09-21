"""
diagnose_student_contest.py
================================================================================
DIAGNOSTIC ENGINE FOR LEETCODE CONTEST SCORE INTEGRITY
================================================================================
Performs zero-assumption forensic audit of a student's contest submissions
and outputs evidence-backed breakdown for Q1, Q2, Q3, Q4.

Usage:
  python backend/scripts/diagnose_student_contest.py --username janani2311 [--contest 516]
"""

import sys
import argparse
import json
from datetime import datetime
from sqlalchemy.orm import Session

from backend.database import SessionLocal
from backend.models import Student, WeeklySession, WeeklyPublicResult, WeeklyVirtualResult, ContestParticipation
from backend.services.contest_problem_accuracy_engine import ContestProblemAccuracyEngine
from backend.services.contest_verification_engine import (
    ContestVerificationEngine, ContestProblemMapping, ProblemDefinition
)


def diagnose_student(username: str, contest_number: int = 516) -> Dict[str, Any]:
    db: Session = SessionLocal()
    try:
        # Find student by handle (case insensitive)
        clean_user = username.strip().lower()
        student = db.query(Student).filter(Student.username.ilike(clean_user)).first()

        student_name = student.name if student else "UNKNOWN STUDENT"
        reg_no = student.reg_no if student else "UNKNOWN REG"
        student_id = student.id if student else 0

        contest_id = f"weekly-contest-{contest_number}"
        contest_name = f"Weekly Contest {contest_number}"

        # 1. Resolve canonical contest problem mapping
        problem_set = ContestProblemAccuracyEngine.resolve_official_problem_set(contest_number=contest_number)
        mapping_problems = []
        for p in problem_set.problems:
            mapping_problems.append(ProblemDefinition(
                question_number=p.index,
                problem_id=p.problem_id,
                title_slug=p.title_slug,
                title=p.title,
                points=p.points
            ))

        prob_mapping = ContestProblemMapping(
            contest_id=contest_id,
            contest_name=contest_name,
            contest_number=contest_number,
            problems=mapping_problems
        )

        # 2. Check Participation State in DB
        participation_type = "NOT_VERIFIED"
        if student:
            # Check WeeklyPublicResult
            p_res = db.query(WeeklyPublicResult).filter(
                WeeklyPublicResult.student_id == student.id
            ).first()
            if p_res and p_res.participation_status in ("PUBLIC", "PUBLIC_ATTENDED", "ATTENDED"):
                participation_type = "ACTUAL"

            # Check WeeklyVirtualResult if not public
            if participation_type != "ACTUAL":
                v_res = db.query(WeeklyVirtualResult).filter(
                    WeeklyVirtualResult.student_id == student.id
                ).first()
                if v_res and v_res.participation_status in ("VIRTUAL", "VIRTUAL_ATTENDED"):
                    participation_type = "VIRTUAL_ATTENDED"

        # 3. Gather raw submissions for student from DB / evidence logs
        raw_submissions = []
        if student:
            participations = db.query(ContestParticipation).filter(
                ContestParticipation.student_id == student.id
            ).all()
            for part in participations:
                if part.submission_times and isinstance(part.submission_times, list):
                    for sub in part.submission_times:
                        raw_submissions.append(sub)

        # Evaluate via ContestVerificationEngine
        ver_res = ContestVerificationEngine.verify_student_contest_participation(
            student_id=student_id,
            leetcode_username=username,
            contest_id=contest_id,
            participation_type=participation_type,
            problem_mapping=prob_mapping,
            raw_submissions=raw_submissions,
            evidence_source="DIAGNOSTIC_AUDIT"
        )

        # Diagnostics Output Formatting
        norm_part = ver_res.participation_type
        diag_output = {
            "Student": student_name,
            "Registration Number": reg_no,
            "LeetCode Username": username,
            "Contest ID": contest_id,
            "Participation State": norm_part,
            "Questions": {}
        }

        for q_num in range(1, 5):
            q_key = f"Q{q_num}"
            prob_def = problem_set.problems[q_num - 1] if q_num <= len(problem_set.problems) else None

            matching_ev = [ev for ev in ver_res.evidence_items if ev.question_number == q_num]
            is_solved = getattr(ver_res, f"q{q_num}") == 1

            diag_output["Questions"][q_key] = {
                "problem_id": prob_def.problem_id if prob_def else f"Q{q_num}",
                "title_slug": prob_def.title_slug if prob_def else "unknown",
                "title": prob_def.title if prob_def else "unknown",
                "submission_ids": [ev.submission_id for ev in matching_ev],
                "timestamps": [str(ev.submission_timestamp) for ev in matching_ev if ev.submission_timestamp],
                "statuses": [ev.submission_status for ev in matching_ev],
                "contest_association": contest_id if is_solved else "UNLINKED",
                "participation_type": norm_part,
                "verification_status": "VERIFIED" if is_solved else "NOT_VERIFIED",
                "reason": ver_res.q_reasons.get(q_key, "No verified evidence")
            }

        diag_output["RAW_ACCEPTED_SUBMISSION_COUNT"] = ver_res.raw_ac_count
        diag_output["VERIFIED_ACTUAL_SOLVED_COUNT"] = ver_res.verified_total if norm_part == "ACTUAL" else 0
        diag_output["VIRTUAL_COUNT"] = ver_res.verified_total if norm_part == "VIRTUAL_ATTENDED" else 0
        diag_output["NOT_VERIFIED_COUNT"] = sum(1 for q in range(1, 5) if getattr(ver_res, f"q{q}") == 0)
        diag_output["FINAL_SCORE"] = f"{diag_output['VERIFIED_ACTUAL_SOLVED_COUNT']}/4"

        return diag_output

    finally:
        db.close()


def print_diagnostic_report(diag: Dict[str, Any]):
    print("=========================================================")
    print("LEETCODE SUNDAY CONTEST SCORE INTEGRITY — DIAGNOSTIC REPORT")
    print("=========================================================")
    print(f"Student: {diag['Student']}")
    print(f"Reg No:  {diag['Registration Number']}")
    print(f"Handle:  {diag['LeetCode Username']}")
    print(f"Contest: {diag['Contest ID']}")
    print(f"State:   {diag['Participation State']}")
    print("---------------------------------------------------------")

    for q_key, q_data in diag["Questions"].items():
        print(f"[{q_key}] Problem: {q_data['title']} ({q_data['title_slug']})")
        print(f"     Problem ID:          {q_data['problem_id']}")
        print(f"     Submissions:         {q_data['submission_ids']}")
        print(f"     Timestamps:          {q_data['timestamps']}")
        print(f"     Statuses:            {q_data['statuses']}")
        print(f"     Contest Association: {q_data['contest_association']}")
        print(f"     Participation Type:  {q_data['participation_type']}")
        print(f"     Verification Status: {q_data['verification_status']}")
        print(f"     Reason:              {q_data['reason']}")
        print()

    print("---------------------------------------------------------")
    print(f"RAW_ACCEPTED_SUBMISSION_COUNT: {diag['RAW_ACCEPTED_SUBMISSION_COUNT']}")
    print(f"VERIFIED_ACTUAL_SOLVED_COUNT:  {diag['VERIFIED_ACTUAL_SOLVED_COUNT']}")
    print(f"VIRTUAL_COUNT:                 {diag['VIRTUAL_COUNT']}")
    print(f"NOT_VERIFIED_COUNT:            {diag['NOT_VERIFIED_COUNT']}")
    print(f"FINAL_SCORE:                   {diag['FINAL_SCORE']}")
    print("=========================================================")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Diagnose LeetCode student contest score integrity.")
    parser.add_argument("--username", type=str, default="janani2311", help="LeetCode handle to diagnose")
    parser.add_argument("--contest", type=int, default=516, help="Contest number (e.g. 516)")
    args = parser.parse_args()

    report = diagnose_student(args.username, args.contest)
    print_diagnostic_report(report)
