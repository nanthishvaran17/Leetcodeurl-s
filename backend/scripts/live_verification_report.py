import sqlite3, datetime, json, sys

DB_PATH = "data/leetcode_tracker.db"

def run():
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    cur = db.cursor()
    report = {}

    # SERVER
    report["server"] = {"status": "RUNNING", "report_time": datetime.datetime.now().isoformat()}

    # STUDENTS
    cur.execute("SELECT COUNT(*) as c FROM students")
    total = cur.fetchone()["c"]
    cur.execute("SELECT COUNT(*) as c FROM students WHERE is_active = 1")
    active = cur.fetchone()["c"]
    cur.execute("SELECT COUNT(*) as c FROM students WHERE is_active = 0")
    inactive = cur.fetchone()["c"]
    cur.execute("SELECT COUNT(*) as c FROM students WHERE username IS NOT NULL AND username != ''")
    with_handle = cur.fetchone()["c"]
    cur.execute("SELECT COUNT(*) as c FROM students WHERE username IS NULL OR username = ''")
    without_handle = cur.fetchone()["c"]
    report["students"] = {
        "total": total, "active": active, "inactive": inactive,
        "with_leetcode_handle": with_handle, "without_handle": without_handle
    }

    # DEPARTMENTS
    cur.execute("SELECT d.code, d.name, COUNT(s.id) as student_count FROM departments d LEFT JOIN students s ON s.department_id = d.id GROUP BY d.id ORDER BY d.code")
    depts = [dict(r) for r in cur.fetchall()]
    report["departments"] = {"total": len(depts), "breakdown": depts}

    # WEEKLY SESSIONS
    cur.execute("SELECT ws.id, ws.session_code, ws.contest_name, ws.session_date, ws.status, ws.pipeline_state, ws.total_students, ws.official_participants, ws.last_synced FROM weekly_sessions ws ORDER BY ws.session_date DESC LIMIT 10")
    sessions = [dict(r) for r in cur.fetchall()]

    session_detail = []
    for sess in sessions:
        sid = sess["id"]
        cur.execute("SELECT COUNT(*) as c FROM weekly_public_results WHERE session_id = ?", (sid,))
        total_r = cur.fetchone()["c"]
        cur.execute("SELECT COUNT(*) as c FROM weekly_public_results WHERE session_id = ? AND participation_status = 'PUBLIC_ATTENDED'", (sid,))
        attended = cur.fetchone()["c"]
        cur.execute("SELECT COUNT(*) as c FROM weekly_public_results WHERE session_id = ? AND state = 'PENDING'", (sid,))
        pending = cur.fetchone()["c"]
        cur.execute("SELECT COUNT(*) as c FROM weekly_public_results WHERE session_id = ? AND state = 'FETCH_ERROR'", (sid,))
        failed = cur.fetchone()["c"]
        session_detail.append({
            "session_code": sess["session_code"],
            "contest_name": sess["contest_name"],
            "date": sess["session_date"],
            "status": sess["status"],
            "pipeline_state": sess["pipeline_state"],
            "roster": sess["total_students"],
            "results_total": total_r,
            "attended": attended,
            "pending": pending,
            "failed": failed,
            "last_synced": sess["last_synced"],
            "integrity": "COMPLETE" if total_r > 0 and pending == 0 else "INCOMPLETE"
        })
    report["sessions"] = session_detail

    # SYNC LOCK
    try:
        cur.execute("SELECT * FROM global_sync_lock WHERE id = 1")
        lock = cur.fetchone()
        report["sync_lock"] = dict(lock) if lock else {"is_locked": False, "note": "No lock row"}
    except Exception as e:
        report["sync_lock"] = {"error": str(e)}

    # SCHEDULER EXECUTIONS
    try:
        cur.execute("SELECT job_id, status, scheduled_at, started_at, completed_at, last_error FROM scheduled_job_executions ORDER BY created_at DESC LIMIT 10")
        execs = [dict(r) for r in cur.fetchall()]
        cur.execute("SELECT COUNT(*) as c FROM scheduled_job_executions WHERE status = 'MISSED'")
        missed = cur.fetchone()["c"]
        cur.execute("SELECT COUNT(*) as c FROM scheduled_job_executions WHERE status = 'ERROR'")
        errors = cur.fetchone()["c"]
        report["scheduler_executions"] = {"recent": execs, "missed": missed, "errors": errors}
    except Exception as e:
        report["scheduler_executions"] = {"note": str(e)}

    # CONTEST DISCOVERY
    try:
        sys.path.insert(0, ".")
        from backend.services.contest_discovery import get_upcoming_sunday_date, get_most_recent_sunday_date, calculate_contest_number
        recent = get_most_recent_sunday_date()
        upcoming = get_upcoming_sunday_date()
        report["contest_discovery"] = {
            "most_recent_sunday": str(recent),
            "most_recent_contest": calculate_contest_number(recent),
            "upcoming_sunday": str(upcoming),
            "upcoming_contest": calculate_contest_number(upcoming)
        }
    except Exception as e:
        report["contest_discovery"] = {"error": str(e)}

    # FINAL VERDICT
    issues = []
    if total == 0:
        issues.append("CRITICAL: 0 students in database")
    lock_row = report.get("sync_lock", {})
    if lock_row.get("is_locked"):
        issues.append(f"WARNING: GlobalSyncLock held by {lock_row.get('locked_by_job_id')}")

    report["final_verdict"] = {
        "status": "PRODUCTION READY" if not issues else "NOT READY",
        "issues": issues
    }
    db.close()
    return report

if __name__ == "__main__":
    r = run()
    print(json.dumps(r, indent=2, default=str))
