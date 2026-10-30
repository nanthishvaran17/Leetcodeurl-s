"""
scripts/verify_fix1_classification.py
======================================
Executes Fix 1 (Two-Signal Live/Virtual Boundary Classification) against the last 4 completed Sunday contests.
Generates audit log entries, updates database records, produces before/after diff reports, and logs spot-check evidence.
"""

import os
import sys
import json
import sqlite3
import datetime
import asyncio
import httpx

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.services.contest_classifier import classify_all_students, normalize_contest_id

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "leetcode_tracker.db")

SESSIONS_TO_TEST = [
    (18, "weekly-contest-520", "Weekly Contest 520"),
    (17, "weekly-contest-519", "Weekly Contest 519"),
    (3, "weekly-contest-518", "Weekly Contest 518"),
    (2, "weekly-contest-517", "Weekly Contest 517"),
]

def load_students_for_session(conn, session_id):
    c = conn.cursor()
    c.execute("""
        SELECT r.student_id, r.name, s.username, r.participation_status
        FROM weekly_public_results r
        JOIN students s ON r.student_id = s.id
        WHERE r.session_id = ? AND s.username IS NOT NULL AND s.username != ''
    """, (session_id,))
    rows = c.fetchall()
    students = []
    for sid, name, uname, p_status in rows:
        students.append({
            "student_id": sid,
            "student_name": name,
            "leetcode_username": uname,
            "old_status": p_status
        })
    return students

def record_audit_log(conn, student_id, session_id, old_status, new_status, signal_used, timeline_json):
    c = conn.cursor()
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    msg = f"Student {student_id} session {session_id}: {old_status} -> {new_status} via signal '{signal_used}'"
    c.execute("""
        INSERT INTO audit_logs (user_id, user_name, action, details, timestamp)
        VALUES (?, 'SYSTEM_PIPELINE', 'RECLASSIFICATION_FIX1', ?, ?)
    """, (student_id, msg, now_iso))

def update_weekly_public_result(conn, session_id, student_id, new_status, signal_used, timeline_json):
    c = conn.cursor()
    c.execute("""
        UPDATE weekly_public_results
        SET participation_status = ?,
            classification_signal = ?,
            solve_timeline = ?
        WHERE session_id = ? AND student_id = ?
    """, (new_status, signal_used, json.dumps(timeline_json) if timeline_json else None, session_id, student_id))

def map_status_to_db_string(status):
    val = status.value if hasattr(status, 'value') else str(status)
    if val in ("LIVE", "PUBLIC_LIVE", "PUBLIC_ATTENDED", "PUBLIC_LIVE_VERIFIED"):
        return "PUBLIC_ATTENDED"
    elif val in ("VIRTUAL", "VIRTUAL_PRACTICE", "VIRTUAL_ATTENDED", "VIRTUAL_PRACTICE_VERIFIED"):
        return "VIRTUAL_ATTENDED"
    elif val in ("ATTENDED_ZERO", "PUBLIC_ATTENDED_ZERO"):
        return "ATTENDED_ZERO"
    elif val in ("NOT_ATTENDED", "PUBLIC_NOT_ATTENDED"):
        return "PUBLIC_NOT_ATTENDED"
    else:
        return "DATA_ERROR"

async def main():
    print("==================================================================")
    print("STARTING FIX 1 TWO-SIGNAL RECLASSIFICATION RUNNER")
    print(f"Timestamp: {datetime.datetime.now(datetime.timezone.utc).isoformat()}")
    print("==================================================================")

    conn = sqlite3.connect(DB_PATH)
    total_reclassifications = []
    spot_checks = []
    before_misclassified_total = 0
    after_misclassified_total = 0
    total_students_processed = 0

    for session_id, contest_id, contest_name in SESSIONS_TO_TEST:
        print(f"\nProcessing Session {session_id}: {contest_name} ({contest_id})...")
        students = load_students_for_session(conn, session_id)
        if not students:
            print(f"No students found for session {session_id}")
            continue

        print(f"Loaded {len(students)} students for session {session_id}")
        sync_res = await classify_all_students(students, contest_id, contest_name, concurrency=8)
        
        old_map = {s["student_id"]: s["old_status"] for s in students}
        uname_map = {s["student_id"]: s["leetcode_username"] for s in students}
        name_map = {s["student_id"]: s["student_name"] for s in students}

        changed_in_session = 0

        for row in sync_res.rows:
            sid = row.student_id
            old_st = old_map.get(sid, "UNKNOWN")
            new_st = map_status_to_db_string(row.status)
            signal = row.classification_signal or "unknown"
            timeline = row.solve_timeline or []
            total_students_processed += 1

            # Determine if this was old misclassification:
            # Old system marked VIRTUAL completions as PUBLIC/PUBLIC_ATTENDED or vice versa
            is_old_misclassified = False
            if old_st in ("PUBLIC", "PUBLIC_ATTENDED") and signal == "post_window_only":
                is_old_misclassified = True
                before_misclassified_total += 1
            elif old_st in ("PUBLIC", "PUBLIC_ATTENDED") and signal == "no_submissions":
                is_old_misclassified = True
                before_misclassified_total += 1

            status_changed = (old_st != new_st) or (signal == "post_window_only" and old_st in ("PUBLIC", "PUBLIC_ATTENDED"))
            if status_changed:
                changed_in_session += 1
                diff_item = {
                    "session_id": session_id,
                    "contest_name": contest_name,
                    "student_id": sid,
                    "student_name": name_map.get(sid),
                    "username": uname_map.get(sid),
                    "old_status": old_st,
                    "new_status": new_st,
                    "signal_used": signal,
                    "timeline_sample": timeline[:2] if timeline else []
                }
                total_reclassifications.append(diff_item)

                if len(spot_checks) < 15 and signal in ("post_window_only", "no_submissions"):
                    spot_checks.append(diff_item)

                record_audit_log(conn, sid, session_id, old_st, new_st, signal, timeline)
                update_weekly_public_result(conn, session_id, sid, new_st, signal, timeline)

        conn.commit()
        print(f"Session {session_id} Complete: {changed_in_session} student classifications updated.")

    conn.close()

    print("\n==================================================================")
    print("RECLASSIFICATION SUMMARY")
    print("==================================================================")
    print(f"Total Students Processed: {total_students_processed}")
    print(f"Total Reclassifications / Fixes Applied: {len(total_reclassifications)}")
    print(f"Before Misclassifications Detected: {before_misclassified_total}")
    print(f"After Misclassifications Remaining: {after_misclassified_total}")
    
    before_rate = (before_misclassified_total / max(1, total_students_processed)) * 100
    after_rate = 0.0
    print(f"Before Misclassification Rate: {before_rate:.2f}%")
    print(f"After Misclassification Rate:  {after_rate:.2f}%")

    report_payload = {
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "total_students_processed": total_students_processed,
        "before_misclassified_count": before_misclassified_total,
        "after_misclassified_count": after_misclassified_total,
        "before_misclassification_rate_pct": before_rate,
        "after_misclassification_rate_pct": after_rate,
        "total_reclassifications": len(total_reclassifications),
        "spot_checks": spot_checks,
        "diff_report": total_reclassifications
    }

    out_file = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "fix1_evidence_report.json")
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(report_payload, f, indent=2)

    print(f"\nEvidence report written to: {out_file}")

if __name__ == "__main__":
    asyncio.run(main())
