# department_report.py
# Production Department-wise & Batch-wise LeetCode Performance Summary Engine
# Generates Academic Coordinator Batch-wise Excel & HTML Email Reports

import pandas as pd
import requests
import sqlite3
import json
import os
import sys
import time
from datetime import datetime
from zoneinfo import ZoneInfo
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch

from backend.database import SessionLocal
from backend.services.email_service import send_email

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

# ============================================
# CONFIGURATION & BATCH MAPPING
# ============================================

IST = ZoneInfo("Asia/Kolkata")
LEETCODE_GRAPHQL_URL = "https://leetcode.com/graphql"
CONTEST_API_BASE = "https://leetcode.com/contest/api/ranking"

BATCH_MAPPING = {
    1: "2025-2029",  # I Year
    2: "2024-2028",  # II Year
    3: "2023-2027",  # III Year
    4: "2022-2026",  # IV Year
}

# ============================================
# FETCH FUNCTIONS
# ============================================

def parse_year_val(val):
    if not val or str(val).strip() == "nan":
        return 3
    s = str(val).strip().upper()
    if s in ('I', '1'): return 1
    if s in ('II', '2'): return 2
    if s in ('III', '3'): return 3
    if s in ('IV', '4'): return 4
    try:
        return int(''.join(filter(str.isdigit, s)))
    except Exception:
        return 3

def fetch_student_profile(username):
    """Fetch total solved, contest rating, and global ranking from LeetCode GraphQL"""
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
        res = requests.post(LEETCODE_GRAPHQL_URL, json=payload, headers=headers, timeout=12)
        if res.status_code == 200:
            data = res.json()
            if "errors" in data and not data.get("data"):
                return None
            user = data.get("data", {}).get("matchedUser", {}) or {}
            contest_info = data.get("data", {}).get("userContestRanking", {}) or {}
            
            submit_stats = user.get("submitStats", {}).get("acSubmissionNum", []) or []
            total_solved = 0
            for stat in submit_stats:
                if stat.get("difficulty") == "All":
                    total_solved = stat.get("count", 0)
                    break
            
            rating = contest_info.get("rating", 0) or user.get("contestRating", 0) or 0
            ranking = contest_info.get("globalRanking", 0) or 0
            
            return {
                "total_solved": int(total_solved),
                "rating": round(float(rating), 1),
                "ranking": int(ranking)
            }
    except Exception:
        pass
    return None

def fetch_contest_rankings(contest_slug):
    """Fetch Same-Day Rankings from Contest Page API"""
    url = f"{CONTEST_API_BASE}/{contest_slug}/"
    all_rankings = []
    page = 1
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Referer": f"https://leetcode.com/contest/{contest_slug}/ranking/"
    }
    while True:
        try:
            res = requests.get(url, params={"pagination": page, "region": "global"}, headers=headers, timeout=12)
            if res.status_code != 200:
                break
            data = res.json()
            rankings = data.get("rankings", [])
            if not rankings:
                break
            all_rankings.extend(rankings)
            if len(all_rankings) >= data.get("total_rank", 0) or page >= 40:
                break
            page += 1
            time.sleep(0.2)
        except Exception:
            break
    return all_rankings

# ============================================
# CLASSIFICATION HELPERS
# ============================================

def classify_problems_solved(total_solved):
    if total_solved > 500:
        return "Above 500"
    elif total_solved >= 250:
        return "250 - 500"
    elif total_solved >= 100:
        return "Less than 250"
    elif total_solved >= 1:
        return "Less than 100"
    else:
        return "Not yet started"

def classify_contest_solved(solved):
    if solved == 4:
        return "4 Q Solved"
    elif solved == 3:
        return "3 Q Solved"
    elif solved == 2:
        return "2 Q Solved"
    elif solved == 1:
        return "1 Q Solved"
    else:
        return "0 Q Solved"

# ============================================
# CORE REPORT PROCESSOR
# ============================================

def load_students_from_excel_or_db():
    """Load students from SQLite database or fallback students.xlsx"""
    students = []
    if os.path.exists("students.xlsx"):
        df = pd.read_excel("students.xlsx")
        for idx, row in df.iterrows():
            u = str(row.get("LeetCodeUsername", "") or "").strip()
            if u and u != "nan":
                y_val = parse_year_val(row.get("Year", 3))
                students.append({
                    "username": u,
                    "name": str(row.get("Name", "Unknown")),
                    "roll_number": str(row.get("RollNumber", f"REG_{idx+1}")),
                    "department": str(row.get("Department", "CSE")),
                    "year": y_val,
                    "batch": BATCH_MAPPING.get(y_val, "2023-2027")
                })
    return students

def generate_department_report(contest_slug, contest_date_str="16.08.2026", coordinator="M.Santhosh Kumar M / AP(CS)"):
    """
    Generate complete Department-wise & Batch-wise LeetCode report
    """
    print(f"\n📊 Generating Department & Batch-wise Report for {contest_slug}...")
    students = load_students_from_excel_or_db()
    print(f"  Loaded {len(students)} active student records.")

    contest_rankings = fetch_contest_rankings(contest_slug)
    contest_map = {c.get("username", ""): c.get("solved", 0) for c in contest_rankings}
    print(f"  Fetched {len(contest_rankings)} contest leaderboard rankings.")

    processed = []
    for idx, s in enumerate(students, 1):
        username = s["username"]
        year = s["year"]
        batch = BATCH_MAPPING.get(year, "2023-2027")

        profile = fetch_student_profile(username)
        total_solved = profile.get("total_solved", 0) if profile else 0
        rating = profile.get("rating", 0) if profile else 0
        ranking = profile.get("ranking", 0) if profile else 0

        contest_solved = contest_map.get(username, 0)

        processed.append({
            "username": username,
            "name": s["name"],
            "roll": s["roll_number"],
            "dept": s["department"],
            "year": year,
            "batch": batch,
            "total_solved": total_solved,
            "total_solved_category": classify_problems_solved(total_solved),
            "contest_solved": contest_solved,
            "contest_category": classify_contest_solved(contest_solved),
            "rating": rating,
            "ranking": ranking,
            "rating_above_1500": rating > 1500,
            "ranking_below_2000": ranking < 2000 and ranking > 0
        })

    # Group by Batch
    batches = {}
    for item in processed:
        b = item["batch"]
        if b not in batches:
            batches[b] = {
                "students": [],
                "total": 0,
                "above_500": 0,
                "250_500": 0,
                "less_250": 0,
                "less_100": 0,
                "not_started": 0,
                "q4": 0,
                "q3": 0,
                "q2": 0,
                "q1": 0,
                "rating_1500": 0,
                "ranking_2000": 0
            }
        
        batches[b]["students"].append(item)
        batches[b]["total"] += 1

        cat = item["total_solved_category"]
        if cat == "Above 500": batches[b]["above_500"] += 1
        elif cat == "250 - 500": batches[b]["250_500"] += 1
        elif cat == "Less than 250": batches[b]["less_250"] += 1
        elif cat == "Less than 100": batches[b]["less_100"] += 1
        else: batches[b]["not_started"] += 1

        c_cat = item["contest_category"]
        if c_cat == "4 Q Solved": batches[b]["q4"] += 1
        elif c_cat == "3 Q Solved": batches[b]["q3"] += 1
        elif c_cat == "2 Q Solved": batches[b]["q2"] += 1
        elif c_cat == "1 Q Solved": batches[b]["q1"] += 1

        if item["rating_above_1500"]: batches[b]["rating_1500"] += 1
        if item["ranking_below_2000"]: batches[b]["ranking_2000"] += 1

    department_name = "COMPUTER SCIENCE AND ENGINEERING (CYBER SECURITY)"
    
    return {
        "department": department_name,
        "coordinator": coordinator,
        "contest": contest_slug,
        "date": contest_date_str,
        "batches": batches,
        "all_students": processed
    }

# ============================================
# EXCEL GENERATOR (BATCH SHEETS + SUMMARY)
# ============================================

def export_department_excel(report_data):
    """Generate Excel report with sheets for each batch and a Summary sheet"""
    filename = f"report_{report_data['date'].replace('.', '')}_department.xlsx"
    
    with pd.ExcelWriter(filename, engine='openpyxl') as writer:
        for batch, stats in sorted(report_data["batches"].items()):
            rows = []
            for idx, student in enumerate(stats["students"], 1):
                rows.append({
                    "S.No": idx,
                    "Register No": student["roll"],
                    "Student Name": student["name"],
                    "Dept": student["dept"],
                    "Year": student["year"],
                    "Status": "VERIFIED" if student["total_solved"] > 0 else "UNVERIFIED",
                    "Q1": "1" if student["contest_solved"] >= 1 else "—",
                    "Q2": "1" if student["contest_solved"] >= 2 else "—",
                    "Q3": "1" if student["contest_solved"] >= 3 else "—",
                    "Q4": "1" if student["contest_solved"] >= 4 else "—",
                    "Contest Solved": student["contest_solved"],
                    "Total Solved": student["total_solved"],
                    "Rank": student["ranking"] if student["ranking"] > 0 else "—",
                    "Rating": student["rating"] if student["rating"] > 0 else "—"
                })
            df_batch = pd.DataFrame(rows)
            # Short sheet name max 31 chars
            sheet_name = f"Batch {batch}" if len(batch) <= 20 else batch
            df_batch.to_excel(writer, sheet_name=sheet_name, index=False)

        # Summary sheet
        summary_rows = []
        for batch, stats in sorted(report_data["batches"].items()):
            summary_rows.append({
                "Batch": batch,
                "Total Count": stats["total"],
                "Above 500": stats["above_500"],
                "250 - 500": stats["250_500"],
                "Less than 250": stats["less_250"],
                "Less than 100": stats["less_100"],
                "Not yet started": stats["not_started"],
                "4 Q Solved": stats["q4"],
                "3 Q Solved": stats["q3"],
                "2 Q Solved": stats["q2"],
                "1 Q Solved": stats["q1"],
                "Rating Above 1500": stats["rating_1500"],
                "Ranking Below 2000": stats["ranking_2000"]
            })
        df_summary = pd.DataFrame(summary_rows)
        df_summary.to_excel(writer, sheet_name="Summary", index=False)

    print(f"  📄 Saved Department Excel: {filename}")
    return filename

# ============================================
# HTML EMAIL TEMPLATE GENERATION
# ============================================

def generate_html_email(report_data):
    """Generate exact Academic Coordinator HTML Email Report"""
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 20px; color: #0f172a; }}
        .header-box {{ background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: white; padding: 24px; border-radius: 8px; text-align: center; }}
        .header-box h2 {{ margin: 0 0 8px 0; font-size: 20px; letter-spacing: 0.5px; color: #38bdf8; }}
        .header-box p {{ margin: 4px 0; font-size: 14px; color: #cbd5e1; }}
        .table {{ width: 100%; border-collapse: collapse; margin: 24px 0; font-size: 13px; }}
        .table th {{ background: #1e293b; color: #f8fafc; padding: 10px 8px; border: 1px solid #475569; font-weight: bold; text-align: center; }}
        .table td {{ padding: 8px 6px; border: 1px solid #cbd5e1; text-align: center; }}
        .table tr:nth-child(even) {{ background: #f8fafc; }}
        .badge-live {{ background: #dcfce7; color: #166534; padding: 2px 6px; border-radius: 4px; font-weight: bold; }}
        .footer {{ margin-top: 30px; padding: 16px; background: #f1f5f9; border-radius: 6px; text-align: center; font-size: 12px; color: #64748b; }}
    </style>
    </head>
    <body>
    
    <div class="header-box">
        <h2>LEETCODE PERFORMANCE — ACADEMIC WEEKLY REPORT</h2>
        <p><strong>Department:</strong> {report_data['department']}</p>
        <p><strong>Academic Coordinator:</strong> {report_data['coordinator']}</p>
        <p><strong>Contest:</strong> {report_data['contest']} &nbsp;|&nbsp; <strong>Date:</strong> {report_data['date']}</p>
    </div>
    
    <h3 style="color: #1e293b; margin-top: 24px;">📊 Batch-Wise Performance Distribution Summary</h3>
    
    <table class="table">
        <tr>
            <th>Batch</th>
            <th>Total Count</th>
            <th>Above 500</th>
            <th>250 - 500</th>
            <th>Less than 250</th>
            <th>Less than 100</th>
            <th>Not yet started</th>
            <th>4 Q Solved</th>
            <th>3 Q Solved</th>
            <th>2 Q Solved</th>
            <th>1 Q Solved</th>
            <th>Rating &gt; 1500</th>
            <th>Ranking &lt; 2000</th>
        </tr>
    """
    
    for batch, stats in sorted(report_data["batches"].items()):
        html += f"""
        <tr>
            <td style="font-weight: bold; color: #0f172a;">{batch}</td>
            <td style="font-weight: bold;">{stats["total"]}</td>
            <td style="color: #15803d; font-weight: bold;">{stats["above_500"]}</td>
            <td style="color: #0369a1;">{stats["250_500"]}</td>
            <td style="color: #334155;">{stats["less_250"]}</td>
            <td style="color: #475569;">{stats["less_100"]}</td>
            <td style="color: #b91c1c;">{stats["not_started"]}</td>
            <td style="background: #dcfce7; color: #166534; font-weight: bold;">{stats["q4"]}</td>
            <td style="background: #f0fdf4; color: #15803d;">{stats["q3"]}</td>
            <td style="background: #fefce8; color: #854d0e;">{stats["q2"]}</td>
            <td style="background: #fff7ed; color: #9a3412;">{stats["q1"]}</td>
            <td style="color: #6b21a8; font-weight: bold;">{stats["rating_1500"]}</td>
            <td style="color: #4338ca; font-weight: bold;">{stats["ranking_2000"]}</td>
        </tr>
        """
    
    html += f"""
    </table>
    
    <div class="footer">
        <p><strong>Nandha Engineering College</strong> — Institutional Coding Intelligence Engine</p>
        <p>Report Generated Automatically on {datetime.now(IST).strftime('%A, %d %B %Y %I:%M %p IST')}</p>
    </div>
    
    </body>
    </html>
    """
    
    return html

# ============================================
# MAIN EXECUTION & EMAIL DISPATCH
# ============================================

def main():
    contest_slug = "weekly-contest-514"
    contest_date_str = "16.08.2026"
    coordinator = "M.Santhosh Kumar M / AP(CS)"

    report_data = generate_department_report(
        contest_slug=contest_slug,
        contest_date_str=contest_date_str,
        coordinator=coordinator
    )

    excel_file = export_department_excel(report_data)
    html_content = generate_html_email(report_data)

    with open("report_email.html", "w", encoding="utf-8") as f:
        f.write(html_content)
    print("  📄 Saved HTML Email Template: report_email.html")

    # Read bytes for email attachment
    with open(excel_file, "rb") as f:
        excel_bytes = f.read()

    attachments = [
        (excel_file, excel_bytes)
    ]

    recipients = ["nanthishvaran17@gmail.com", "msanthoshkumar@nandhaengg.org"]
    subject = f"LeetCode Performance - Weekly Report — {report_data['department']}"

    print(f"\n📧 Dispatching Department Report Emails to: {recipients}...")
    for email in recipients:
        ok, err = send_email(
            recipient=email,
            subject=subject,
            html_body=html_content,
            attachments=attachments
        )
        print(f"  -> Dispatched to {email}: Success={ok}, Error={err}")

    print("\n" + "=" * 70)
    print("  ✅ DEPARTMENT REPORT GENERATION & EMAIL DISPATCH COMPLETE!")
    print("=" * 70)

if __name__ == "__main__":
    main()
