# sunday_automation_complete.py
# Complete Sunday Automation - Two Reports with Student Timestamp Tracking
# 100% Automated LeetCode Weekly Contest Tracking System

import requests
import pandas as pd
import sqlite3
import json
import smtplib
import os
import sys
import time
import argparse
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from backend.services.email_service import send_email

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

# ============================================
# CONFIGURATION
# ============================================

IST = ZoneInfo("Asia/Kolkata")
CONTEST_API_BASE = "https://leetcode.com/contest/api/ranking"
LEETCODE_GRAPHQL_URL = "https://leetcode.com/graphql"
STUDENTS_EXCEL_PATH = "students.xlsx"

# ============================================
# CLASSIFICATION WITH TIMESTAMP
# ============================================

def classify_participation(finish_time_seconds, contest_date):
    """
    Classify participation with exact timestamp calculation
    """
    if finish_time_seconds is None or finish_time_seconds == 0:
        return {
            "type": "NOT_ATTENDED",
            "time": None,
            "display": "🔴 NOT ATTENDED",
            "detail": "—"
        }
    
    # Contest start: Sunday 8:00 AM IST
    contest_start = contest_date.replace(hour=8, minute=0, second=0, microsecond=0)
    
    # Calculate actual completion time
    actual_time = contest_start + timedelta(seconds=finish_time_seconds)
    
    # Official contest window: within 90 minutes (8:00 - 9:30 AM)
    if finish_time_seconds <= 5400:
        return {
            "type": "LIVE",
            "time": actual_time,
            "display": "🟢 LIVE",
            "detail": actual_time.strftime("Sunday %I:%M %p")
        }
    else:
        # After 9:30 AM IST is VIRTUAL
        if actual_time.day != contest_start.day:
            day_str = "Monday"
        else:
            day_str = "Sunday"
        return {
            "type": "VIRTUAL",
            "time": actual_time,
            "display": "🟣 VIRTUAL",
            "detail": actual_time.strftime(f"{day_str} %I:%M %p")
        }

# ============================================
# FETCH CONTEST & STUDENT DATA
# ============================================

def fetch_contest_rankings(contest_slug):
    """Fetch contest rankings from Contest Page API with fallback"""
    all_rankings = []
    page = 1
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Referer": f"https://leetcode.com/contest/{contest_slug}/ranking/"
    }
    
    while True:
        url = f"{CONTEST_API_BASE}/{contest_slug}/"
        params = {"pagination": page, "region": "global"}
        try:
            response = requests.get(url, params=params, headers=headers, timeout=12)
            if response.status_code != 200:
                break
            data = response.json()
            rankings = data.get("rankings", [])
            if not rankings:
                break
            all_rankings.extend(rankings)
            total = data.get("total_rank", 0)
            if len(all_rankings) >= total or page >= 50:
                break
            page += 1
            time.sleep(0.3)
        except Exception:
            break
    
    return all_rankings

def get_student_profile(username):
    """Fetch student public stats from GraphQL"""
    query = """
    query userPublicProfile($username: String!) {
      matchedUser(username: $username) {
        username
        submitStats {
          acSubmissionNum {
            difficulty
            count
          }
        }
        contestRating
      }
      userContestRanking(username: $username) {
        rating
        globalRanking
      }
    }
    """
    payload = {"query": query, "variables": {"username": username}}
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    }
    try:
        response = requests.post(LEETCODE_GRAPHQL_URL, json=payload, headers=headers, timeout=10)
        if response.status_code == 200:
            data = response.json()
            user = data.get("data", {}).get("matchedUser", {}) or {}
            contest_info = data.get("data", {}).get("userContestRanking", {}) or {}
            if user or contest_info:
                submit_stats = user.get("submitStats", {}).get("acSubmissionNum", []) or []
                total_solved = 0
                for stat in submit_stats:
                    if stat.get("difficulty") == "All":
                        total_solved = stat.get("count", 0)
                        break
                return {
                    "total_solved": int(total_solved),
                    "rating": round(float(contest_info.get("rating", 0) or user.get("contestRating", 0) or 0), 1),
                    "ranking": int(contest_info.get("globalRanking", 0) or 0)
                }
    except Exception:
        pass
    return None

def load_students_roster():
    """Load normalized student roster from students.xlsx or database"""
    if os.path.exists(STUDENTS_EXCEL_PATH):
        df = pd.read_excel(STUDENTS_EXCEL_PATH)
        students = []
        for idx, row in df.iterrows():
            u = str(row.get("LeetCodeUsername", "") or "").strip()
            if u == "nan" or not u:
                u = ""
            students.append({
                "roll_number": str(row.get("RollNumber", f"REG_{idx+1}")),
                "name": str(row.get("Name", "Unknown")),
                "year": str(row.get("Year", "III")),
                "department": str(row.get("Department", "CSE")),
                "username": u
            })
        return students
    return []

def fetch_profile_contest_data(username, contest_slug):
    """Fetch contest participation from student profile GraphQL"""
    query = """
    query userContestRankingInfo($username: String!) {
      userContestRankingHistory(username: $username) {
        attended
        problemsSolved
        finishTimeInSeconds
        ranking
        contest {
          title
          startTime
        }
      }
    }
    """
    payload = {"query": query, "variables": {"username": username}}
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    }
    try:
        res = requests.post(LEETCODE_GRAPHQL_URL, json=payload, headers=headers, timeout=12)
        if res.status_code == 200:
            data = res.json()
            history = data.get("data", {}).get("userContestRankingHistory", []) or []
            slug_num = ''.join(filter(str.isdigit, contest_slug))
            for contest in history:
                title = contest.get("contest", {}).get("title", "")
                t_num = ''.join(filter(str.isdigit, title))
                if contest_slug.lower() in title.lower() or (slug_num and slug_num == t_num):
                    return {
                        "attended": contest.get("attended", False),
                        "problems_solved": contest.get("problemsSolved", 0),
                        "finish_time": contest.get("finishTimeInSeconds", 0),
                        "rank": contest.get("ranking", 0)
                    }
    except Exception:
        pass
    return None

def process_students_with_timestamps(students, contest_slug, contest_date):
    """Process all students and compute exact timestamps"""
    rankings = fetch_contest_rankings(contest_slug)
    rank_map = {r.get("username"): r for r in rankings if r.get("username")}
    
    results = []
    
    for s in students:
        username = s.get("username", "").strip()
        name = s.get("name", "Unknown")
        roll = s.get("roll_number", "")
        dept = s.get("department", "")
        year = s.get("year", "III")
        
        finish_time = None
        solved = 0
        rank = None
        attended = False
        
        if username and username in rank_map:
            data = rank_map[username]
            finish_time = data.get("finish_time", 0)
            solved = data.get("solved", 0)
            rank = data.get("rank", 0)
            attended = True
        elif username:
            prof_contest = fetch_profile_contest_data(username, contest_slug)
            if prof_contest and prof_contest.get("attended"):
                finish_time = prof_contest.get("finish_time", 0)
                solved = prof_contest.get("problems_solved", 0)
                rank = prof_contest.get("rank", 0)
                attended = True
        
        if attended:
            classification = classify_participation(finish_time, contest_date)
            profile = get_student_profile(username)
            rating = profile.get("rating", 0) if profile else 0
            
            results.append({
                "name": name,
                "roll": roll,
                "department": dept,
                "year": year,
                "username": username,
                "participation_type": classification["type"],
                "participation_display": classification["display"],
                "participation_time": classification["detail"],
                "problems_solved": solved,
                "rank": rank if classification["type"] == "LIVE" else None,
                "rating": rating if classification["type"] == "LIVE" else None,
                "finish_time": finish_time
            })
        else:
            results.append({
                "name": name,
                "roll": roll,
                "department": dept,
                "year": year,
                "username": username,
                "participation_type": "NOT_ATTENDED",
                "participation_display": "🔴 NOT ATTENDED",
                "participation_time": "—",
                "problems_solved": 0,
                "rank": None,
                "rating": None,
                "finish_time": None
            })
    
    return results

# ============================================
# GENERATE TWO REPORTS (INTERNAL & EXTERNAL)
# ============================================

def generate_two_reports(results, contest_slug, contest_date):
    """Generate both Internal (all + timestamps) and External (official only) Excel reports"""
    live = [r for r in results if r["participation_type"] == "LIVE"]
    virtual = [r for r in results if r["participation_type"] == "VIRTUAL"]
    not_attended = [r for r in results if r["participation_type"] == "NOT_ATTENDED"]
    
    date_str = contest_date.strftime("%Y%m%d")
    
    # --------------------------------------------
    # 1. INTERNAL REPORT (HOD + Faculty)
    # --------------------------------------------
    internal_data = []
    for idx, r in enumerate(results, 1):
        internal_data.append({
            "S.No": idx,
            "Roll No": r["roll"],
            "Student Name": r["name"],
            "Dept": r["department"],
            "Year": r["year"],
            "Participation": r["participation_display"],
            "Time Attended": r["participation_time"],
            "Solved": r["problems_solved"],
            "Rank": r["rank"] if r["rank"] else "—",
            "Rating": r["rating"] if r["rating"] else "—"
        })
    internal_df = pd.DataFrame(internal_data)
    
    virtual_times = {}
    for r in virtual:
        t = r["participation_time"]
        virtual_times[t] = virtual_times.get(t, 0) + 1
    
    internal_file = f"report_internal_{date_str}.xlsx"
    with pd.ExcelWriter(internal_file, engine='openpyxl') as writer:
        internal_df.to_excel(writer, sheet_name='Raw Data', index=False)
        
        tot = len(results) if len(results) > 0 else 1
        summary_rows = [
            ["PARTICIPATION SUMMARY (INTERNAL)"],
            ["Category", "Count", "Percentage"],
            ["🟢 LIVE (Official 8:00-9:30 AM)", len(live), f"{round(len(live)/tot*100, 1)}%"],
            ["🟣 VIRTUAL (Post 9:30 AM)", len(virtual), f"{round(len(virtual)/tot*100, 1)}%"],
            ["🔴 NOT ATTENDED", len(not_attended), f"{round(len(not_attended)/tot*100, 1)}%"],
            [],
            ["VIRTUAL PARTICIPATION TIME BREAKDOWN"],
            ["Time Range", "Students"]
        ]
        for time_key, count in sorted(virtual_times.items()):
            summary_rows.append([time_key, count])
        
        pd.DataFrame(summary_rows).to_excel(writer, sheet_name='Summary', index=False, header=False)
    
    # --------------------------------------------
    # 2. EXTERNAL REPORT (College / Management)
    # --------------------------------------------
    external_data = []
    for idx, r in enumerate(results, 1):
        if r["participation_type"] == "LIVE":
            external_data.append({
                "S.No": idx,
                "Roll No": r["roll"],
                "Student Name": r["name"],
                "Dept": r["department"],
                "Year": r["year"],
                "Participation": "🟢 LIVE",
                "Solved": r["problems_solved"],
                "Rank": r["rank"] if r["rank"] else "—",
                "Rating": r["rating"] if r["rating"] else "—"
            })
        else:
            external_data.append({
                "S.No": idx,
                "Roll No": r["roll"],
                "Student Name": r["name"],
                "Dept": r["department"],
                "Year": r["year"],
                "Participation": "🔴 NOT ATTENDED",
                "Solved": 0,
                "Rank": "—",
                "Rating": "—"
            })
    external_df = pd.DataFrame(external_data)
    
    external_file = f"report_external_{date_str}.xlsx"
    with pd.ExcelWriter(external_file, engine='openpyxl') as writer:
        external_df.to_excel(writer, sheet_name='Raw Data', index=False)
        
        tot = len(results) if len(results) > 0 else 1
        official_not_attended = len(virtual) + len(not_attended)
        external_summary_rows = [
            ["OFFICIAL PARTICIPATION SUMMARY (MANAGEMENT)"],
            ["Category", "Count", "Percentage"],
            ["🟢 LIVE (Official)", len(live), f"{round(len(live)/tot*100, 1)}%"],
            ["🔴 NOT ATTENDED", official_not_attended, f"{round(official_not_attended/tot*100, 1)}%"]
        ]
        pd.DataFrame(external_summary_rows).to_excel(writer, sheet_name='Summary', index=False, header=False)
    
    return {
        "internal_file": internal_file,
        "external_file": external_file,
        "live": len(live),
        "virtual": len(virtual),
        "not_attended": len(not_attended),
        "total": len(results),
        "virtual_times": virtual_times
    }

# ============================================
# AUTOMATED SUNDAY PIPELINE RUNNER
# ============================================

def run_sunday_automation(contest_slug="weekly-contest-514", contest_date=None, dispatch_email=True):
    """Executes the complete Sunday automation pipeline"""
    if contest_date is None:
        contest_date = datetime.now(IST)
    
    print("\n" + "=" * 70)
    print("🚀 SUNDAY AUTOMATION PIPELINE EXECUTING")
    print("=" * 70)
    print(f"📅 Contest Slug: {contest_slug}")
    print(f"🕐 Date:         {contest_date.strftime('%A, %d %B %Y')}")
    print("=" * 70)
    
    students = load_students_roster()
    print(f"📊 Loaded {len(students)} student roster records.")
    
    results = process_students_with_timestamps(students, contest_slug, contest_date)
    reports = generate_two_reports(results, contest_slug, contest_date)
    
    print(f"\n📊 Summary Stats:")
    print(f"  • 🟢 LIVE (Official):    {reports['live']} ({round(reports['live']/reports['total']*100, 1)}%)")
    print(f"  • 🟣 VIRTUAL (Post 9:30): {reports['virtual']} ({round(reports['virtual']/reports['total']*100, 1)}%)")
    print(f"  • 🔴 NOT ATTENDED:        {reports['not_attended']} ({round(reports['not_attended']/reports['total']*100, 1)}%)")
    print(f"\n📁 Saved Excel Reports:")
    print(f"  • Internal: {reports['internal_file']}")
    print(f"  • External: {reports['external_file']}")
    
    if dispatch_email:
        recipient = "nanthishvaran17@gmail.com"
        subject = f"Weekly LeetCode Contest Report — {contest_slug.upper()}"
        
        with open(reports['internal_file'], "rb") as f:
            int_bytes = f.read()
        with open(reports['external_file'], "rb") as f:
            ext_bytes = f.read()
            
        attachments = [
            (reports['internal_file'], int_bytes),
            (reports['external_file'], ext_bytes)
        ]
        
        body_html = f"""
        <html>
        <body style="font-family: Arial, sans-serif; color: #0f172a; margin: 20px;">
            <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: white; padding: 20px; border-radius: 8px;">
                <h2 style="margin: 0; color: #38bdf8;">Weekly LeetCode Contest Automated Report</h2>
                <p style="margin: 5px 0 0 0; color: #cbd5e1;">Contest: {contest_slug} &nbsp;|&nbsp; Date: {contest_date.strftime('%d %B %Y')}</p>
            </div>
            <h3 style="margin-top: 20px;">Participation Summary</h3>
            <table style="border-collapse: collapse; width: 100%; max-width: 600px;">
                <tr style="background: #1e293b; color: white;">
                    <th style="padding: 8px; border: 1px solid #475569;">Category</th>
                    <th style="padding: 8px; border: 1px solid #475569;">Count</th>
                    <th style="padding: 8px; border: 1px solid #475569;">Percentage</th>
                </tr>
                <tr>
                    <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold;">🟢 LIVE (Official)</td>
                    <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">{reports['live']}</td>
                    <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">{round(reports['live']/reports['total']*100, 1)}%</td>
                </tr>
                <tr>
                    <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold;">🟣 VIRTUAL</td>
                    <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">{reports['virtual']}</td>
                    <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">{round(reports['virtual']/reports['total']*100, 1)}%</td>
                </tr>
                <tr>
                    <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold;">🔴 NOT ATTENDED</td>
                    <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">{reports['not_attended']}</td>
                    <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">{round(reports['not_attended']/reports['total']*100, 1)}%</td>
                </tr>
            </table>
            <p style="margin-top: 20px; font-size: 13px; color: #64748b;">
                Attached are both Internal (Full + Timestamps) and External (Official) Excel reports.
            </p>
        </body>
        </html>
        """
        
        print(f"\n📧 Dispatching Dual Reports Email to: {recipient}...")
        ok, err = send_email(
            recipient=recipient,
            subject=subject,
            html_body=body_html,
            attachments=attachments
        )
        print(f"  -> Dispatched to {recipient}: Success={ok}, Error={err}")
    
    print("\n" + "=" * 70)
    print("✅ SUNDAY AUTOMATION PIPELINE COMPLETED SUCCESSFULLY")
    print("=" * 70)
    return reports

# ============================================
# APSCHEDULER INITIALIZATION
# ============================================

def start_scheduler():
    """Start automated scheduler for every Sunday & Monday"""
    scheduler = BackgroundScheduler(timezone=IST)
    
    # Sunday 8:00 AM - Contest starts
    scheduler.add_job(
        lambda: run_sunday_automation(dispatch_email=False),
        trigger=CronTrigger(day_of_week='sun', hour=8, minute=0),
        id='sunday_0800_start'
    )
    
    # Sunday 9:30 AM - Live contest ends / snapshot
    scheduler.add_job(
        lambda: run_sunday_automation(dispatch_email=False),
        trigger=CronTrigger(day_of_week='sun', hour=9, minute=30),
        id='sunday_0930_live_end'
    )
    
    # Monday 7:00 AM - Generate dual reports and email
    scheduler.add_job(
        lambda: run_sunday_automation(dispatch_email=True),
        trigger=CronTrigger(day_of_week='mon', hour=7, minute=0),
        id='monday_0700_final_dispatch'
    )
    
    scheduler.start()
    print("\n✅ Automated Scheduler Active in Asia/Kolkata timezone:")
    print("  📅 Sunday 08:00 AM - Contest Tracking Begins")
    print("  📅 Sunday 09:30 AM - Live Contest Ends & Snapshot")
    print("  📅 Monday 07:00 AM - Dual Reports Generation & Email Dispatch")
    return scheduler

# ============================================
# CLI INTERFACE
# ============================================

def main():
    parser = argparse.ArgumentParser(description="Complete Sunday Automation - Dual Reports with Timestamps")
    parser.add_argument("--contest", default="weekly-contest-514", help="Contest slug")
    parser.add_argument("--date", default="2026-08-09", help="Contest date (YYYY-MM-DD)")
    parser.add_argument("--no-email", action="store_true", help="Skip email dispatch")
    parser.add_argument("--schedule", action="store_true", help="Start persistent scheduler daemon")
    
    args = parser.parse_args()
    
    contest_date = datetime.strptime(args.date, "%Y-%m-%d").replace(tzinfo=IST)
    run_sunday_automation(
        contest_slug=args.contest,
        contest_date=contest_date,
        dispatch_email=not args.no_email
    )
    
    if args.schedule:
        scheduler = start_scheduler()
        try:
            while True:
                time.sleep(60)
        except (KeyboardInterrupt, SystemExit):
            scheduler.shutdown()
            print("\n⚠️ Scheduler stopped.")

if __name__ == "__main__":
    main()
