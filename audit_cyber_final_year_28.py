# audit_cyber_final_year_28.py
import sys
import os
import time
import datetime
import requests
import pandas as pd
from zoneinfo import ZoneInfo

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

IST = ZoneInfo("Asia/Kolkata")
EXCEL_PATH = "students.xlsx"
GRAPHQL_URL = "https://leetcode.com/graphql"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Content-Type": "application/json",
    "Referer": "https://leetcode.com"
}

# Contest 516 Problem Matching
WC516_PROBLEMS = {
    "Q1": ["find-special-substring-of-length-k", "check-ascii-palindromic", "special substring", "length k", "ascii", "palindromic"],
    "Q2": ["maximum-manhattan-distance-after-k-changes", "find-all-numbers-disappeared-in-an-array-ii", "manhattan distance", "k changes", "disappeared"],
    "Q3": ["count-substrings-divisible-by-last-digit", "longest-subarray-with-at-most-k-distinct-prime-factors", "divisible by last digit", "prime factors"],
    "Q4": ["maximum-difference-between-even-and-odd-frequency-ii", "sum-game", "even and odd frequency", "sum game"]
}

QUERY = """
query getStudentContestAndSubs($username: String!) {
  matchedUser(username: $username) {
    username
    submitStats {
      acSubmissionNum {
        difficulty
        count
      }
    }
  }
  userContestRanking(username: $username) {
    rating
    globalRanking
  }
  userContestRankingHistory(username: $username) {
    attended
    problemsSolved
    totalProblems
    finishTimeInSeconds
    contest {
      title
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

def check_q(title, slug):
    t_clean = (title or "").lower()
    s_clean = (slug or "").lower()
    for q_id, patterns in WC516_PROBLEMS.items():
        if any(p in s_clean or p in t_clean for p in patterns):
            return q_id
    return None

def main():
    df = pd.read_excel(EXCEL_PATH)
    cs_final = df[(df['Department'] == 'CSE(CS)') & (df['Year'] == 'IV')]
    print(f"Auditing all {len(cs_final)} Cyber Security Final Year (IV Year) students...")

    today_start_ts = int(datetime.datetime(2026, 8, 23, 0, 0, 0, tzinfo=IST).timestamp())
    results = []

    for idx, row in cs_final.iterrows():
        reg = str(row['RollNumber'])
        name = str(row['Name'])
        uname = str(row['LeetCodeUsername']).strip()

        if not uname or uname == "nan":
            results.append({
                "reg": reg, "name": name, "uname": "—", "solved_cnt": 0,
                "q1": 0, "q2": 0, "q3": 0, "q4": 0, "mode": "NO_USERNAME",
                "details": "Missing LeetCode Username", "today_subs": 0
            })
            continue

        try:
            resp = requests.post(GRAPHQL_URL, json={"query": QUERY, "variables": {"username": uname}}, headers=HEADERS, timeout=12)
            if resp.status_code == 200:
                data = resp.json().get("data", {}) or {}
                matched = data.get("matchedUser")
                if not matched:
                    results.append({
                        "reg": reg, "name": name, "uname": uname, "solved_cnt": 0,
                        "q1": 0, "q2": 0, "q3": 0, "q4": 0, "mode": "USER_NOT_FOUND",
                        "details": "Username Not Found", "today_subs": 0
                    })
                    continue

                hist = data.get("userContestRankingHistory") or []
                recent_subs = data.get("recentAcSubmissionList") or []

                is_live = False
                live_solved = 0
                for h in hist:
                    if "516" in str(h.get("contest", {}).get("title", "")):
                        is_live = bool(h.get("attended"))
                        live_solved = int(h.get("problemsSolved") or 0)
                        break

                q_set = set()
                today_sub_count = 0
                for sub in recent_subs:
                    ts = int(sub.get("timestamp") or 0)
                    if ts >= (today_start_ts - 7200): # Today
                        today_sub_count += 1
                        q_match = check_q(sub.get("title"), sub.get("titleSlug"))
                        if q_match:
                            q_set.add(q_match)

                q1 = 1 if "Q1" in q_set or (is_live and live_solved >= 1) else 0
                q2 = 1 if "Q2" in q_set or (is_live and live_solved >= 2) else 0
                q3 = 1 if "Q3" in q_set or (is_live and live_solved >= 3) else 0
                q4 = 1 if "Q4" in q_set or (is_live and live_solved >= 4) else 0

                tot_c_solved = max(live_solved, len(q_set), (q1 + q2 + q3 + q4))

                if is_live: mode = "LIVE"
                elif tot_c_solved > 0: mode = "VIRTUAL / PRACTICE"
                elif today_sub_count > 0: mode = "PRACTICE_OTHER"
                else: mode = "NOT_ATTENDED"

                results.append({
                    "reg": reg, "name": name, "uname": uname, "solved_cnt": tot_c_solved,
                    "q1": q1, "q2": q2, "q3": q3, "q4": q4, "mode": mode,
                    "today_subs": today_sub_count,
                    "details": f"Live:{live_solved}, QSet:{sorted(list(q_set))}, TodaySubs:{today_sub_count}"
                })
            else:
                results.append({
                    "reg": reg, "name": name, "uname": uname, "solved_cnt": 0,
                    "q1": 0, "q2": 0, "q3": 0, "q4": 0, "mode": "HTTP_ERROR",
                    "details": f"HTTP {resp.status_code}", "today_subs": 0
                })
        except Exception as e:
            results.append({
                "reg": reg, "name": name, "uname": uname, "solved_cnt": 0,
                "q1": 0, "q2": 0, "q3": 0, "q4": 0, "mode": "TIMEOUT_ERROR",
                "details": str(e), "today_subs": 0
            })
        time.sleep(0.2)

    print("\n" + "=" * 105)
    print("INDIVIDUAL AUDIT REPORT: 28 CYBER SECURITY FINAL YEAR (IV YEAR) STUDENTS")
    print("=" * 105)
    print(f"{'S.No':4} | {'Reg No':8} | {'Student Name':22} | {'LeetCode User':20} | {'Solved':6} | {'Q1':2} {'Q2':2} {'Q3':2} {'Q4':2} | {'Status/Mode':18} | {'Today Subs'}")
    print("-" * 105)

    solved_students = [r for r in results if r['solved_cnt'] > 0 or r['today_subs'] > 0]
    c_solved = [r for r in results if r['solved_cnt'] > 0]
    
    for idx, r in enumerate(results, 1):
        solved_str = f"{r['solved_cnt']}/4" if r['solved_cnt'] > 0 else "—"
        q_str = f"{r['q1']}  {r['q2']}  {r['q3']}  {r['q4']}"
        print(f"{idx:4d} | {r['reg']:8} | {r['name']:22} | {r['uname']:20} | {solved_str:6} | {q_str:11} | {r['mode']:18} | {r['today_subs']} subs")

    print("\n" + "=" * 105)
    print(f"TOTAL STUDENTS IN FINAL YEAR CYBER: 28")
    print(f"  • Students with Contest 516 Solves (Q1..Q4): {len(c_solved)} / 28")
    print(f"  • Students Active Today (Any AC sub / contest): {len(solved_students)} / 28")
    print(f"    - 4Q Solved: {len([r for r in results if r['solved_cnt'] == 4])}")
    print(f"    - 3Q Solved: {len([r for r in results if r['solved_cnt'] == 3])}")
    print(f"    - 2Q Solved: {len([r for r in results if r['solved_cnt'] == 2])}")
    print(f"    - 1Q Solved: {len([r for r in results if r['solved_cnt'] == 1])}")
    print(f"    - 0 Solved:  {len([r for r in results if r['solved_cnt'] == 0])}")
    print("=" * 105)

if __name__ == "__main__":
    main()
