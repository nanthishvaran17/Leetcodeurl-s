import asyncio
import httpx
import json
import time
from datetime import datetime, timezone
import zoneinfo
from backend.database import SessionLocal
from backend.models import Student

GRAPHQL_URL = 'https://leetcode.com/graphql'
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    'Content-Type': 'application/json',
    'Referer': 'https://leetcode.com'
}

QUERY = """
query userContestAndSubs($username: String!) {
  matchedUser(username: $username) {
    username
    profile {
      ranking
      realName
    }
    submitStatsGlobal {
      acSubmissionNum {
        difficulty
        count
      }
    }
  }
  userContestRanking(username: $username) {
    attendedContestsCount
    rating
    globalRanking
    totalParticipants
    topPercentage
  }
  userContestRankingHistory(username: $username) {
    attended
    problemsSolved
    totalProblems
    rating
    ranking
    contest {
      title
      startTime
    }
  }
  recentAcSubmissionList(username: $username, limit: 30) {
    id
    title
    titleSlug
    timestamp
  }
}
"""

async def full_cohort_deep_scan():
    db = SessionLocal()
    students = db.query(Student).filter((Student.is_active == True) | (Student.is_active.is_(None))).order_by(Student.id.asc()).all()
    print(f"Total students in master roster: {len(students)}")

    # IST timestamps for today 06.09.2026 08:00 to 09:30 AM
    ist_tz = zoneinfo.ZoneInfo("Asia/Kolkata")
    dt_base = datetime(2026, 9, 6, tzinfo=ist_tz)
    c_start_ts = int(datetime(2026, 9, 6, 8, 0, 0, tzinfo=ist_tz).timestamp())
    c_end_ts = int(datetime(2026, 9, 6, 9, 30, 0, tzinfo=ist_tz).timestamp())
    print(f"Contest 518 Window IST: {c_start_ts} to {c_end_ts}")

    results_summary = {
        "VALID_HANDLES": 0,
        "PENDING_HANDLE": 0,
        "INVALID_CONFIRMED": 0,
        "CONTEST_ATTENDED": 0,
        "CONTEST_NOT_ATTENDED": 0,
        "VIRTUAL_PARTICIPATION": 0,
        "TEMP_FAILURES": 0
    }

    students_with_activity = []
    invalid_handles = []
    pending_handles = []

    limits = httpx.Limits(max_connections=60, max_keepalive_connections=30)
    timeout = httpx.Timeout(10.0, connect=4.0)

    async with httpx.AsyncClient(headers=HEADERS, limits=limits, timeout=timeout) as client:
        sem = asyncio.Semaphore(25)

        async def check_student(s):
            raw_u = (s.username or "").strip()
            # Strip leading @ if present
            if raw_u.startswith("@"):
                raw_u = raw_u[1:].strip()

            if not raw_u or raw_u in ("", "None", "null") or len(raw_u) < 2:
                results_summary["PENDING_HANDLE"] += 1
                pending_handles.append((s.id, s.reg_no, s.name, s.department.code if s.department else "CSE"))
                return

            clean_u = raw_u

            async with sem:
                for attempt in range(3):
                    try:
                        resp = await client.post(
                            GRAPHQL_URL,
                            json={"query": QUERY, "variables": {"username": clean_u}}
                        )
                        if resp.status_code == 200:
                            res_data = resp.json().get("data", {})
                            matched = res_data.get("matchedUser")
                            if matched is None:
                                results_summary["INVALID_CONFIRMED"] += 1
                                invalid_handles.append((s.id, s.reg_no, s.name, clean_u))
                                return

                            results_summary["VALID_HANDLES"] += 1
                            canonical_u = matched.get("username", clean_u)

                            # Check 1: userContestRankingHistory
                            history = res_data.get("userContestRankingHistory") or []
                            c518_hist = None
                            for h in history:
                                if "518" in str(h.get("contest", {}).get("title", "")):
                                    c518_hist = h
                                    break

                            # Check 2: recentAcSubmissionList in window
                            subs = res_data.get("recentAcSubmissionList") or []
                            window_subs = []
                            for sub in subs:
                                sub_ts = int(sub.get("timestamp", 0))
                                # Check if within contest window or today
                                if c_start_ts - 300 <= sub_ts <= c_end_ts + 3600:
                                    window_subs.append(sub)

                            if c518_hist and c518_hist.get("attended"):
                                solved = c518_hist.get("problemsSolved", 0)
                                rank = c518_hist.get("ranking")
                                results_summary["CONTEST_ATTENDED"] += 1
                                students_with_activity.append({
                                    "student": s.name, "reg_no": s.reg_no, "username": canonical_u,
                                    "type": "PUBLIC_OFFICIAL_HIST", "solved": solved, "rank": rank,
                                    "window_subs": len(window_subs)
                                })
                            elif len(window_subs) > 0:
                                results_summary["CONTEST_ATTENDED"] += 1
                                students_with_activity.append({
                                    "student": s.name, "reg_no": s.reg_no, "username": canonical_u,
                                    "type": "PUBLIC_WINDOW_SUBS", "solved": len(window_subs),
                                    "sub_titles": [w.get("title") for w in window_subs]
                                })
                            else:
                                results_summary["CONTEST_NOT_ATTENDED"] += 1
                            return
                        elif resp.status_code == 429:
                            await asyncio.sleep(1.0 + attempt)
                            continue
                        else:
                            if attempt == 2:
                                results_summary["TEMP_FAILURES"] += 1
                                return
                    except Exception as e:
                        if attempt == 2:
                            results_summary["TEMP_FAILURES"] += 1
                            return
                        await asyncio.sleep(0.5)

        tasks = [check_student(s) for s in students]
        await asyncio.gather(*tasks)

    print("\n" + "=" * 60)
    print("318-STUDENT LEETCODE FULL ROSTER RECONCILIATION SUMMARY")
    print("=" * 60)
    for k, v in results_summary.items():
        print(f"{k:25}: {v}")
    print("=" * 60)
    print(f"Total Evaluated: {sum([results_summary['PENDING_HANDLE'], results_summary['INVALID_CONFIRMED'], results_summary['CONTEST_ATTENDED'], results_summary['CONTEST_NOT_ATTENDED'], results_summary['VIRTUAL_PARTICIPATION'], results_summary['TEMP_FAILURES']])} / {len(students)}")
    print("\nStudents with Contest 518 Activity:")
    for a in students_with_activity:
        print("  ->", a)
    print(f"\nTotal Pending Handles: {len(pending_handles)}")
    print(f"Total Invalid Handles: {len(invalid_handles)}")
    db.close()

if __name__ == '__main__':
    asyncio.run(full_cohort_deep_scan())
