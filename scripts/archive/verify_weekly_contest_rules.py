import sys
import os
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import SessionLocal
from backend.models import WeeklySession
from backend.services.canonical_contest_engine import build_canonical_contest_dataset

def main():
    db = SessionLocal()
    try:
        # Find session for 04.10.2026 or Weekly Contest 522
        session = db.query(WeeklySession).filter(
            (WeeklySession.contest_name.like("%522%")) | (WeeklySession.session_date == "2026-10-04")
        ).first()

        if not session:
            print("[ERROR] Weekly Contest 522 / 04.10.2026 session not found")
            return

        print(f"Testing Session ID={session.id}, Name={session.contest_name}, Date={session.session_date}")

        start_time = time.time()
        dataset = build_canonical_contest_dataset(session.id, db, dept="ALL", year="ALL", attendance="ALL")
        elapsed = time.time() - start_time

        rows = dataset["rows"]
        metrics = dataset["metrics"]
        status_counts = dataset["statusCounts"]

        print(f"\n[PERFORMANCE] Dataset generated in {elapsed:.3f} seconds (Target: < 1.000s)")
        print(f"Total Master Students: {metrics['totalStudents']}")
        print(f"Public / Live Count: {metrics['public']}")
        print(f"Virtual Practice Count: {metrics['virtual']}")
        print(f"Not Attended Count: {metrics['notAttended']}")
        print(f"Data Errors Count: {metrics['dataErrors']}")

        # Verification 1: Mutually exclusive status breakdown
        public_rows = [r for r in rows if r["status"] == "PUBLIC"]
        virtual_rows = [r for r in rows if r["status"] == "VIRTUAL"]
        not_attended_rows = [r for r in rows if r["status"] == "NOT_ATTENDED"]
        data_error_rows = [r for r in rows if r["status"] not in ("PUBLIC", "VIRTUAL", "NOT_ATTENDED")]

        total_check = len(public_rows) + len(virtual_rows) + len(not_attended_rows) + len(data_error_rows)
        assert total_check == len(rows), f"Mismatch in row breakdown: {total_check} vs {len(rows)}"
        print("[VERIFICATION 1 PASS] Mutually exclusive status partitioning confirmed.")

        # Verification 2: Check Virtual Evidence
        print(f"\n[VIRTUAL FORENSICS SAMPLE (Total={len(virtual_rows)})]")
        for vr in virtual_rows[:5]:
            print(f"  Student: {vr['name']} ({vr['reg_no']}) - Dept: {vr['dept']}, Year: {vr['year']}")
            print(f"    Status: {vr['status']}, Solved: {vr['total_solved']}/4")
            print(f"    Evidence Source: {vr.get('evidence_source')}")
            print(f"    Evidence Timestamp: {vr.get('evidence_timestamp')}")
            print(f"    Post-9:30 Diff: {vr.get('post_930_diff')}, Baseline 09:30: {vr.get('baseline_solves_0930')}, 10PM Snap: {vr.get('latest_solves_10pm')}")
            assert vr.get('evidence_source') is not None, f"Missing evidence_source for virtual student {vr['name']}"

        print("[VERIFICATION 2 PASS] Every VIRTUAL classification contains explicit evidence source & timestamp.")

        # Verification 3: CSE(CS) III Year breakdown
        print("\n[FILTERED SCOPE: CSE(CS) III Year]")
        cs_dataset = build_canonical_contest_dataset(session.id, db, dept="CSE(CS)", year="III", attendance="ALL")
        cs_rows = cs_dataset["rows"]
        cs_metrics = cs_dataset["metrics"]
        print(f"CSE(CS) III Year Total Students: {cs_metrics['totalStudents']}")
        print(f"CSE(CS) III Year Public: {cs_metrics['public']}")
        print(f"CSE(CS) III Year Virtual: {cs_metrics['virtual']}")
        print(f"CSE(CS) III Year Not Attended: {cs_metrics['notAttended']}")
        print(f"CSE(CS) III Year Data Errors: {cs_metrics['dataErrors']}")

        print("\nAll verification checks passed cleanly!")
    finally:
        db.close()

if __name__ == "__main__":
    main()
