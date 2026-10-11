"""
sunday_live_poller.py
======================
Runs on AWS EC2 during Sunday Contest (8:00 AM to 9:30 AM IST).
Continuously polls active student submissions via LeetCode GraphQL and
pushes real-time solve events into the Database and WebSocket broadcast.

Usage:
  python backend/scripts/sunday_live_poller.py
"""

import sys
import os
import time
from datetime import datetime
from zoneinfo import ZoneInfo
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from backend.database import SessionLocal, engine
from backend.models import Student, WeeklySession, WeeklyPublicResult, PreviousWeekParticipationRecord
from backend.websocket_manager import manager

# Configure sqlite timeout and WAL mode
if "sqlite" in str(engine.url):
    with engine.connect() as conn:
        try:
            conn.exec_driver_sql("PRAGMA journal_mode=WAL;")
            conn.exec_driver_sql("PRAGMA busy_timeout=60000;")
        except Exception:
            pass

GQL_URL = "https://leetcode.com/graphql"
RECENT_SUB_QUERY = """
query recentSubmissions($username: String!) {
  recentSubmissionList(username: $username) {
    title
    titleSlug
    timestamp
    statusDisplay
  }
}
"""


def get_active_session():
    """Finds current active WeeklySession."""
    db = SessionLocal()
    try:
        now_ist = datetime.now(ZoneInfo("Asia/Kolkata"))
        ws = db.query(WeeklySession).order_by(WeeklySession.id.desc()).first()
        return ws
    finally:
        db.close()


def check_student_live(student, start_ts, end_ts):
    handle = student.username or student.primary_leetcode_id
    if not handle and student.leetcode_url:
        handle = student.leetcode_url.strip().rstrip("/").split("/")[-1]
    if not handle:
        return None

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": f"https://leetcode.com/{handle}/",
        "Content-Type": "application/json"
    }
    payload = {
        "query": RECENT_SUB_QUERY,
        "variables": {"username": handle.strip()}
    }

    try:
        resp = requests.post(GQL_URL, json=payload, headers=headers, timeout=10)
        if resp.status_code == 200:
            subs = resp.json().get("data", {}).get("recentSubmissionList", [])
            solves = []
            for sub in subs:
                ts = int(sub.get("timestamp", 0))
                status = sub.get("statusDisplay")
                if start_ts <= ts <= end_ts and status == "Accepted":
                    solves.append({
                        "title": sub.get("title"),
                        "slug": sub.get("titleSlug"),
                        "time": datetime.fromtimestamp(ts, tz=ZoneInfo("Asia/Kolkata")).strftime("%I:%M %p")
                    })
            if solves:
                return (student, solves)
    except Exception:
        pass
    return None


def run_live_loop():
    print("[INFO] Starting Sunday Live Contest Poller on AWS EC2...")
    ws = get_active_session()
    if not ws:
        print("[ERROR] No active WeeklySession found in DB.")
        return

    print(f"[INFO] Monitoring for Session: {ws.contest_name} (ID: {ws.id})")

    # Time boundaries (Sunday 8:00 AM to 9:30 AM IST)
    now_ist = datetime.now(ZoneInfo("Asia/Kolkata"))
    # Epoch for contest start
    start_dt = now_ist.replace(hour=8, minute=0, second=0, microsecond=0)
    end_dt = now_ist.replace(hour=9, minute=30, second=0, microsecond=0)
    
    start_ts = int(start_dt.timestamp())
    end_ts = int(end_dt.timestamp())

    db = SessionLocal()
    students = db.query(Student).all()
    db.close()
    print(f"[INFO] Loaded {len(students)} students to monitor live.")

    seen_solves = {}  # student_id -> set of solved slugs

    while True:
        current_ist = datetime.now(ZoneInfo("Asia/Kolkata"))
        # Stop at 9:31 AM
        if current_ist > end_dt:
            print("[INFO] Contest window (9:30 AM IST) ended. Stopping live poller.")
            break

        print(f"\n[LIVE POLLE] Checking student progress at {current_ist.strftime('%I:%M:%S %p IST')}...")
        updates_batch = []

        with ThreadPoolExecutor(max_workers=20) as executor:
            futures = [executor.submit(check_student_live, s, start_ts, end_ts) for s in students]
            for f in as_completed(futures):
                res = f.result()
                if res:
                    student, solves = res
                    new_solves = [s for s in solves if s["slug"] not in seen_solves.get(student.id, set())]
                    if new_solves:
                        updates_batch.append((student, new_solves))
                        if student.id not in seen_solves:
                            seen_solves[student.id] = set()
                        for ns in new_solves:
                            seen_solves[student.id].add(ns["slug"])

        if updates_batch:
            print(f"[LIVE UPDATE] Detected {len(updates_batch)} new solves!")
            db = SessionLocal()
            for st, new_s in updates_batch:
                total_solved = len(seen_solves[st.id])
                print(f"  🔥 {st.name} (@{st.username}) solved {new_s[0]['title']} at {new_s[0]['time']}! Total: {total_solved}")

                # Update DB
                wpr = db.query(WeeklyPublicResult).filter_by(session_id=ws.id, student_id=st.id).first()
                if not wpr:
                    wpr = WeeklyPublicResult(session_id=ws.id, student_id=st.id, attended=True, solved_count=total_solved)
                    db.add(wpr)
                else:
                    wpr.attended = True
                    wpr.solved_count = max(wpr.solved_count, total_solved)

                # Broadcast via WebSocket
                try:
                    payload = {
                        "type": "CONTEST_STUDENT_SOLVED",
                        "session_id": ws.id,
                        "student_id": st.id,
                        "student_name": st.name,
                        "username": st.username,
                        "solved_count": total_solved,
                        "problem_title": new_s[0]["title"],
                        "solved_time": new_s[0]["time"]
                    }
                    manager.broadcast_sync(payload)
                except Exception as e:
                    pass

            try:
                db.commit()
            except Exception as e:
                db.rollback()
            finally:
                db.close()

        # Sleep 45 seconds between polling sweeps
        time.sleep(45)


if __name__ == "__main__":
    run_live_loop()
