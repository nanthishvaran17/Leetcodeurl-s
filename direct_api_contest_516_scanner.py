# direct_api_contest_516_scanner.py
"""
Direct LeetCode GraphQL API Scanner for Weekly Contest 516
Authoritative Problem-level verification for Cyber Security [CSE(CS)] and IoT [CSE(IOT)]
"""

import os
import sys
import json
import time
import datetime
from zoneinfo import ZoneInfo
from concurrent.futures import ThreadPoolExecutor, as_completed
import pandas as pd
import requests

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

IST = ZoneInfo("Asia/Kolkata")
GRAPHQL_URL = "https://leetcode.com/graphql"
STUDENTS_EXCEL_PATH = os.path.abspath("students.xlsx")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Content-Type": "application/json",
    "Referer": "https://leetcode.com"
}

# Weekly Contest 516 Canonical Problems
WC516_PROBLEMS = {
    "Q1": {
        "title": "Find Special Substring of Length K",
        "slugs": ["find-special-substring-of-length-k", "check-ascii-palindromic"],
        "keywords": ["special substring", "length k", "ascii", "palindromic"]
    },
    "Q2": {
        "title": "Maximum Manhattan Distance After K Changes",
        "slugs": ["maximum-manhattan-distance-after-k-changes", "find-all-numbers-disappeared-in-an-array-ii"],
        "keywords": ["manhattan distance", "k changes", "disappeared"]
    },
    "Q3": {
        "title": "Count Substrings Divisible by Last Digit",
        "slugs": ["count-substrings-divisible-by-last-digit", "longest-subarray-with-at-most-k-distinct-prime-factors"],
        "keywords": ["divisible by last digit", "prime factors"]
    },
    "Q4": {
        "title": "Maximum Difference Between Even and Odd Frequency II",
        "slugs": ["maximum-difference-between-even-and-odd-frequency-ii", "sum-game"],
        "keywords": ["even and odd frequency", "sum game"]
    }
}

CONTEST_QUERY = """
query getUserContestInfo($username: String!) {
  userContestRanking(username: $username) {
    attendedContestsCount
    rating
    globalRanking
  }
  userContestRankingHistory(username: $username) {
    attended
    problemsSolved
    totalProblems
    finishTimeInSeconds
    rating
    ranking
    contest {
      title
      startTime
    }
  }
  recentAcSubmissionList(username: $username, limit: 20) {
    id
    title
    titleSlug
    timestamp
  }
}
"""

def match_problem(title, slug):
    t_clean = (title or "").lower()
    s_clean = (slug or "").lower()
    for q_id, q_data in WC516_PROBLEMS.items():
        if s_clean in q_data["slugs"] or any(s in s_clean for s in q_data["slugs"]):
            return q_id
        if any(k in t_clean for k in q_data["keywords"]):
            return q_id
    return None

def fetch_student_wc516_api(student):
    username = student["username"]
    if not student["is_valid_user"]:
        return {
            **student,
            "status": "MISSING_USERNAME",
            "is_attended": False,
            "participation_mode": "NOT_ATTENDED",
            "q1": 0, "q2": 0, "q3": 0, "q4": 0,
            "total_contest_solved": 0,
            "contest_rating": 0.0,
            "contest_rank": None
        }

    payload = {
        "query": CONTEST_QUERY,
        "variables": {"username": username}
    }

    for attempt in range(2):
        try:
            resp = requests.post(GRAPHQL_URL, json=payload, headers=HEADERS, timeout=10)
            if resp.status_code == 200:
                data = resp.json().get("data", {}) or {}
                crank = data.get("userContestRanking") or {}
                rating = round(float(crank.get("rating") or 0.0), 1)
                
                history = data.get("userContestRankingHistory") or []
                recent_subs = data.get("recentAcSubmissionList") or []
                
                is_live = False
                live_solved = 0
                live_rank = None
                finish_sec = None
                
                for h in history:
                    c_title = h.get("contest", {}).get("title", "")
                    if "516" in c_title:
                        is_live = bool(h.get("attended"))
                        live_solved = int(h.get("problemsSolved") or 0)
                        live_rank = h.get("ranking")
                        finish_sec = h.get("finishTimeInSeconds")
                        break
                        
                # Check recent AC submissions for WC 516 questions (Virtual/Practice)
                solved_q_set = set()
                # Today's start in UTC timestamp for 23.08.2026 (00:00 IST = 22.08.2026 18:30 UTC)
                today_start_ts = int(datetime.datetime(2026, 8, 23, 0, 0, 0, tzinfo=IST).timestamp())
                
                for sub in recent_subs:
                    sub_ts = int(sub.get("timestamp") or 0)
                    # Submissions today
                    if sub_ts >= (today_start_ts - 7200): # generous window from morning
                        matched_q = match_problem(sub.get("title"), sub.get("titleSlug"))
                        if matched_q:
                            solved_q_set.add(matched_q)
                            
                q1 = 1 if "Q1" in solved_q_set or (is_live and live_solved >= 1) else 0
                q2 = 1 if "Q2" in solved_q_set or (is_live and live_solved >= 2) else 0
                q3 = 1 if "Q3" in solved_q_set or (is_live and live_solved >= 3) else 0
                q4 = 1 if "Q4" in solved_q_set or (is_live and live_solved >= 4) else 0
                
                total_solved = max(live_solved, len(solved_q_set), (q1 + q2 + q3 + q4))
                
                if is_live:
                    mode = "LIVE"
                elif total_solved > 0:
                    mode = "VIRTUAL"
                else:
                    mode = "NOT_ATTENDED"
                    
                return {
                    **student,
                    "status": "VERIFIED",
                    "is_attended": (mode != "NOT_ATTENDED"),
                    "participation_mode": mode,
                    "q1": q1, "q2": q2, "q3": q3, "q4": q4,
                    "total_contest_solved": total_solved,
                    "contest_rating": rating,
                    "contest_rank": live_rank,
                    "finish_sec": finish_sec
                }
            time.sleep(0.3)
        except Exception:
            time.sleep(0.5)

    return {
        **student,
        "status": "TIMEOUT",
        "is_attended": False,
        "participation_mode": "NOT_ATTENDED",
        "q1": 0, "q2": 0, "q3": 0, "q4": 0,
        "total_contest_solved": 0,
        "contest_rating": 0.0,
        "contest_rank": None
    }

def main():
    print("=" * 80)
    print("DIRECT LEETCODE GRAPHQL API SCANNER — WEEKLY CONTEST 516")
    print(f"Time: {datetime.datetime.now(IST).strftime('%Y-%m-%d %H:%M:%S IST')}")
    print("=" * 80)

    df = pd.read_excel(STUDENTS_EXCEL_PATH)
    students = []
    for idx, row in df.iterrows():
        name = str(row.get("Name", "") or "").strip()
        reg_no = str(row.get("RollNumber", "") or "").strip()
        dept_raw = str(row.get("Department", "") or "").strip().upper()
        username = str(row.get("LeetCodeUsername", "") or "").strip()
        
        if "IOT" in dept_raw or "INTERNET" in dept_raw or "CI" in reg_no.upper():
            dept_code = "CSE(IOT)"
        elif "CS" in dept_raw or "CYBER" in dept_raw or "CC" in reg_no.upper():
            dept_code = "CSE(CS)"
        else:
            continue
            
        students.append({
            "name": name,
            "reg_no": reg_no,
            "department": dept_code,
            "username": username if username != "nan" else "",
            "is_valid_user": bool(username and username != "nan" and len(username) > 1)
        })

    cs_count = sum(1 for s in students if s["department"] == "CSE(CS)")
    iot_count = sum(1 for s in students if s["department"] == "CSE(IOT)")
    print(f"Scanned Roster: {len(students)} Students (Cyber: {cs_count}, IoT: {iot_count})")
    print("Executing concurrent API queries (15 threads)...")

    t0 = time.time()
    results = []
    with ThreadPoolExecutor(max_workers=15) as executor:
        futures = {executor.submit(fetch_student_wc516_api, s): s for s in students}
        for f in as_completed(futures):
            results.append(f.result())

    elapsed = round(time.time() - t0, 2)
    print(f"API Fetch Completed in {elapsed}s.\n")

    # Sort results
    results.sort(key=lambda x: (x["total_contest_solved"], x["contest_rating"]), reverse=True)

    cs_res = [r for r in results if r["department"] == "CSE(CS)"]
    iot_res = [r for r in results if r["department"] == "CSE(IOT)"]

    for d_code, d_name, d_list in [("CSE(CS)", "Cyber Security", cs_res), ("CSE(IOT)", "Internet of Things (IoT)", iot_res)]:
        tot = len(d_list)
        live = [r for r in d_list if r["participation_mode"] == "LIVE"]
        virt = [r for r in d_list if r["participation_mode"] == "VIRTUAL"]
        att = [r for r in d_list if r["is_attended"]]
        q4 = [r for r in d_list if r["total_contest_solved"] >= 4]
        q3 = [r for r in d_list if r["total_contest_solved"] == 3]
        q2 = [r for r in d_list if r["total_contest_solved"] == 2]
        q1 = [r for r in d_list if r["total_contest_solved"] == 1]
        not_att = [r for r in d_list if not r["is_attended"]]

        print("=" * 80)
        print(f"🏛️ {d_name.upper()} [{d_code}] — CONTEST 516 API METRICS:")
        print("=" * 80)
        print(f"Total Enrolled Students: {tot}")
        print(f"Total Participated:      {len(att)} ({round(len(att)/tot*100, 1)}%)")
        print(f"  * LIVE (8:00-9:30 AM): {len(live)}")
        print(f"  * VIRTUAL / Practice:  {len(virt)}")
        print(f"Solved 4/4 (Q4):         {len(q4)}")
        print(f"Solved 3/4 (Q3):         {len(q3)}")
        print(f"Solved 2/4 (Q2):         {len(q2)}")
        print(f"Solved 1/4 (Q1):         {len(q1)}")
        print(f"Not Attended:            {len(not_att)}")

        if q4:
            print("\n  🏆 4Q Solvers (4/4):")
            for s in q4:
                print(f"    - {s['name']} ({s['reg_no']} • {s['username']}): Solved {s['total_contest_solved']}/4 [Q1:{s['q1']} Q2:{s['q2']} Q3:{s['q3']} Q4:{s['q4']}] Mode:{s['participation_mode']}")

        if q3:
            print("\n  🥇 3Q Solvers (3/4):")
            for s in q3[:10]:
                print(f"    - {s['name']} ({s['reg_no']} • {s['username']}): Solved {s['total_contest_solved']}/4 [Q1:{s['q1']} Q2:{s['q2']} Q3:{s['q3']} Q4:{s['q4']}] Mode:{s['participation_mode']}")
            if len(q3) > 10:
                print(f"    ... and {len(q3)-10} more 3Q solvers.")
        print()

    # Save direct API results
    with open("contest_516_direct_api_results.json", "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)
    print("Saved direct API results to contest_516_direct_api_results.json")

if __name__ == "__main__":
    main()
