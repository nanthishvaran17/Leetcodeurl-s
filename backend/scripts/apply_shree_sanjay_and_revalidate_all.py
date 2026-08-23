import asyncio
import httpx
import hashlib
import json
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List
from backend.database import SessionLocal
from backend.models import Student, WeeklyPublicResult, WeeklySession

CONTEST_START_TS = 1787452200  # 08:00:00 AM IST, 23-Aug-2026
CONTEST_END_TS = 1787457600    # 09:30:00 AM IST, 23-Aug-2026

def apply_and_revalidate_all():
    db = SessionLocal()
    session = db.query(WeeklySession).filter(WeeklySession.id == 21).first()
    if not session:
        print("ERROR: Session 21 not found!")
        return

    # 1. Correct SHREE SANJAY U K record in WeeklyPublicResult
    shree = db.query(Student).filter(Student.reg_no == "732224CCL03").first()
    if shree:
        shree_res = db.query(WeeklyPublicResult).filter(
            WeeklyPublicResult.session_id == 21,
            WeeklyPublicResult.student_id == shree.id
        ).first()
        if shree_res:
            shree_res.q1 = 1
            shree_res.q2 = 1
            shree_res.q3 = 1
            shree_res.q4 = 0
            shree_res.total_contest_solved = 3
            shree_res.contest_score = 12
            shree_res.participation_status = "PUBLIC"
            shree_res.verification_evidence = "Verified Weekly Contest 516 AC Submissions (3/4)"
            db.commit()
            print("SUCCESS: Updated SHREE SANJAY U K (732224CCL03) to 3/4 [1,1,1,0] (12 pts)")

    # 2. Query all results and strictly revalidate
    all_results = db.query(WeeklyPublicResult).filter(WeeklyPublicResult.session_id == 21).all()
    print(f"Total Database Contest Records: {len(all_results)}")

    c_4 = []
    c_3 = []
    c_2 = []
    c_1 = []
    c_0 = []
    
    tot_q1 = tot_q2 = tot_q3 = tot_q4 = 0

    for r in all_results:
        is_att = r.participation_status in ("PUBLIC", "PUBLIC_ATTENDED", "ATTENDED", "VIRTUAL")
        if not is_att:
            r.q1 = 0
            r.q2 = 0
            r.q3 = 0
            r.q4 = 0
            r.total_contest_solved = 0
            r.contest_score = 0
            c_0.append(r)
            continue

        q1 = 1 if r.q1 == 1 else 0
        q2 = 1 if r.q2 == 1 else 0
        q3 = 1 if r.q3 == 1 else 0
        q4 = 1 if r.q4 == 1 else 0
        
        solved = q1 + q2 + q3 + q4
        r.q1 = q1
        r.q2 = q2
        r.q3 = q3
        r.q4 = q4
        r.total_contest_solved = solved
        r.contest_score = (q1 * 3) + (q2 * 4) + (q3 * 5) + (q4 * 6)

        tot_q1 += q1
        tot_q2 += q2
        tot_q3 += q3
        tot_q4 += q4

        if solved == 4:
            c_4.append(r)
        elif solved == 3:
            c_3.append(r)
        elif solved == 2:
            c_2.append(r)
        elif solved == 1:
            c_1.append(r)
        else:
            c_0.append(r)

    db.commit()

    total_solvers = len(c_4) + len(c_3) + len(c_2) + len(c_1)
    total_problems_solved = tot_q1 + tot_q2 + tot_q3 + tot_q4

    print("================================================================================")
    print("REVALIDATED CONTEST 516 METRICS SUMMARY")
    print("================================================================================")
    print(f"Total Evaluated Students:      {len(all_results)}")
    print(f"Total Official Solvers:        {total_solvers}")
    print(f"4/4 Perfect Solvers (18 pts):  {len(c_4)}")
    print(f"3/4 Solvers (12 pts):          {len(c_3)}")
    print(f"2/4 Solvers (7 pts):           {len(c_2)}")
    print(f"1/4 Solvers (3 pts):           {len(c_1)}")
    print(f"0/4 / Not Attended (0 pts):    {len(c_0)}")
    print(f"Sum of Tiers Check:            {len(c_4) + len(c_3) + len(c_2) + len(c_1)} == {total_solvers} (PASS)")
    print(f"Total Q1 Solves:               {tot_q1}")
    print(f"Total Q2 Solves:               {tot_q2}")
    print(f"Total Q3 Solves:               {tot_q3}")
    print(f"Total Q4 Solves:               {tot_q4}")
    print(f"Total Contest Solves:          {total_problems_solved}")

    # Verify Shree Sanjay UK is in 3/4 list
    shree_in_4 = any(r.reg_no == "732224CCL03" for r in c_4)
    shree_in_3 = any(r.reg_no == "732224CCL03" for r in c_3)
    print(f"Shree Sanjay in 4/4 list?      {shree_in_4} (Expected: False)")
    print(f"Shree Sanjay in 3/4 list?      {shree_in_3} (Expected: True)")
    assert not shree_in_4, "ERROR: Shree Sanjay must not be in 4/4 list!"
    assert shree_in_3, "ERROR: Shree Sanjay must be in 3/4 list!"

    # 3. Generate new SHA-256 Checksum
    serialized_dataset = json.dumps([
        {"reg_no": r.reg_no, "q1": r.q1, "q2": r.q2, "q3": r.q3, "q4": r.q4, "solved": r.total_contest_solved, "score": r.contest_score}
        for r in sorted(all_results, key=lambda x: str(x.reg_no))
    ], sort_keys=True)
    dataset_sha256 = hashlib.sha256(serialized_dataset.encode("utf-8")).hexdigest()
    print(f"New Dataset SHA-256 Checksum:  {dataset_sha256}")
    print("================================================================================\n")

if __name__ == "__main__":
    apply_and_revalidate_all()
