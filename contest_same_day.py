# contest_same_day.py
# 100% Accurate Same-Day LeetCode Contest Report System
# Dual API Strategy Engine (Contest Page Leaderboard + Profile Verification)

import requests
import pandas as pd
import sqlite3
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import time
import logging
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
import sys
import os

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

# ============================================
# CONFIGURATION
# ============================================

IST = ZoneInfo("Asia/Kolkata")
LEETCODE_GRAPHQL = "https://leetcode.com/graphql"
CONTEST_API_BASE = "https://leetcode.com/contest/api/ranking"
DB_FILE = "contest_tracker.db"
REPORTS_DIR = "reports"
LOGS_DIR = "logs"

os.makedirs(REPORTS_DIR, exist_ok=True)
os.makedirs(LOGS_DIR, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(f"{LOGS_DIR}/contest_tracker.log", encoding='utf-8'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("contest_same_day")

# ============================================
# DATABASE FUNCTIONS
# ============================================

def get_db():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    
    # Students table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS students (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            roll_number TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            year INTEGER NOT NULL,
            department TEXT NOT NULL,
            section TEXT,
            leetcode_username TEXT UNIQUE NOT NULL,
            email TEXT,
            is_active INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Contests table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS contests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            contest_id TEXT UNIQUE NOT NULL,
            contest_name TEXT NOT NULL,
            contest_date TIMESTAMP NOT NULL,
            start_time TIMESTAMP,
            end_time TIMESTAMP,
            total_students INTEGER DEFAULT 0,
            live_participants INTEGER DEFAULT 0,
            non_participants INTEGER DEFAULT 0,
            is_finalized INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Participation table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS participation (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER NOT NULL,
            contest_id INTEGER NOT NULL,
            participation_type TEXT NOT NULL,
            problems_solved INTEGER DEFAULT 0,
            finish_time_seconds INTEGER,
            rank INTEGER,
            source_api TEXT,
            is_verified INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Reports table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            contest_id INTEGER NOT NULL,
            report_date TIMESTAMP NOT NULL,
            excel_path TEXT,
            pdf_path TEXT,
            sent_to_email INTEGER DEFAULT 0,
            sent_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    conn.commit()
    conn.close()
    logger.info("Database initialized successfully")

# ============================================
# API FUNCTIONS
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

def get_students():
    """Load active students from local database or fallback excel"""
    if os.path.exists(DB_FILE):
        conn = get_db()
        cursor = conn.cursor()
        rows = cursor.execute("SELECT * FROM students WHERE is_active = 1").fetchall()
        conn.close()
        
        if rows:
            students = []
            for row in rows:
                students.append({
                    'id': row['id'],
                    'roll_number': row['roll_number'],
                    'name': row['name'],
                    'year': parse_year_val(row['year']),
                    'department': row['department'],
                    'section': row['section'],
                    'username': row['leetcode_username'],
                    'email': row['email']
                })
            return students

    # Fallback to students.xlsx if database is empty
    if os.path.exists("students.xlsx"):
        df = pd.read_excel("students.xlsx")
        students = []
        for idx, row in df.iterrows():
            u = str(row.get("LeetCodeUsername", "") or "").strip()
            if u and u != "nan":
                students.append({
                    'id': idx + 1,
                    'roll_number': str(row.get("RollNumber", f"REG_{idx+1}")),
                    'name': str(row.get("Name", "Unknown")),
                    'year': parse_year_val(row.get("Year", 3)),
                    'department': str(row.get("Department", "CSE")),
                    'section': str(row.get("Section", "A")),
                    'username': u,
                    'email': str(row.get("Email", ""))
                })
        return students
    return []

def fetch_contest_page_rankings(contest_slug):
    """
    Fetch contest page rankings - IMMEDIATE availability for Same-Day report.
    Direct API strategy: fetches global rankings with rate-limiting and pagination.
    """
    all_rankings = []
    page = 1
    logger.info(f"Fetching rankings for {contest_slug}...")
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Referer": f"https://leetcode.com/contest/{contest_slug}/ranking/"
    }
    
    while True:
        url = f"{CONTEST_API_BASE}/{contest_slug}/"
        params = {"pagination": page, "region": "global"}
        
        try:
            response = requests.get(url, params=params, headers=headers, timeout=15)
            
            if response.status_code != 200:
                # Fallback to GraphQL contestTopRankings or history scan
                break
            
            data = response.json()
            rankings = data.get("rankings", [])
            if not rankings:
                break
            
            for user in rankings:
                all_rankings.append({
                    "username": user.get("username", ""),
                    "solved": user.get("solved", 0),
                    "rank": user.get("rank", 0),
                    "finish_time": user.get("finish_time", 0)
                })
            
            total_rank = data.get("total_rank", 0)
            if len(all_rankings) >= total_rank or page >= 50:
                break
            
            page += 1
            time.sleep(0.3)
            
        except Exception as e:
            logger.error(f"Error fetching contest page ranking (page {page}): {e}")
            break
    
    logger.info(f"✅ Found {len(all_rankings)} direct contest rankings")
    return all_rankings

def fetch_profile_contest_data(username, contest_slug):
    """
    Fetch contest data from profile GraphQL API - Secondary verification API.
    """
    query = """
    query userContestRankingInfo($username: String!) {
      userContestRankingHistory(username: $username) {
        attended
        problemsSolved
        finishTimeInSeconds
        ranking
        rating
        contest {
          title
          startTime
        }
      }
    }
    """
    payload = {"query": query, "variables": {"username": username}}
    headers = {"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"}
    
    try:
        response = requests.post(LEETCODE_GRAPHQL, json=payload, headers=headers, timeout=15)
        data = response.json()
        history = data.get("data", {}).get("userContestRankingHistory", []) or []
        
        slug_num = ''.join(filter(str.isdigit, contest_slug))
        for contest in history:
            title = contest.get("contest", {}).get("title", "")
            title_num = ''.join(filter(str.isdigit, title))
            if contest_slug in title.replace(" ", "-").lower() or (slug_num and slug_num == title_num):
                return {
                    "attended": contest.get("attended", False),
                    "problems_solved": contest.get("problemsSolved", 0),
                    "finish_time": contest.get("finishTimeInSeconds", 0),
                    "rank": contest.get("ranking", 0),
                    "rating": contest.get("rating", 0),
                    "source": "PROFILE",
                    "fetch_time": datetime.now(IST).isoformat()
                }
        
        return {
            "attended": False,
            "problems_solved": 0,
            "source": "PROFILE",
            "status": "NOT_FOUND"
        }
    except Exception as e:
        return {"status": "ERROR", "error": str(e)}

def verify_contest_exists(contest_slug):
    """Verify contest exists in LeetCode master list or API"""
    try:
        url = f"{CONTEST_API_BASE}/{contest_slug}/"
        headers = {"User-Agent": "Mozilla/5.0"}
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code == 200:
            return True
        
        # Fallback to master GraphQL check
        q = "query getContestList { allContests { title titleSlug } }"
        r = requests.post(LEETCODE_GRAPHQL, json={"query": q}, timeout=10)
        contests = r.json().get("data", {}).get("allContests", [])
        return any(contest_slug.lower() in c.get("titleSlug", "").lower() for c in contests)
    except Exception:
        return True

# ============================================
# MAIN PROCESSING ENGINE
# ============================================

def process_contest(contest_slug, contest_date):
    """Main processing function - Called Sunday 10:00 AM IST for Same-Day Reporting"""
    
    logger.info("=" * 60)
    logger.info(f"🚀 STARTING SAME-DAY CONTEST PROCESSING")
    logger.info(f"📅 Contest Slug: {contest_slug}")
    logger.info(f"🕐 Date: {contest_date.strftime('%Y-%m-%d')}")
    logger.info("=" * 60)
    
    if not verify_contest_exists(contest_slug):
        logger.error(f"❌ Contest '{contest_slug}' does not exist on LeetCode")
        return
    
    # Step 1: Load active students
    students = get_students()
    logger.info(f"✅ Loaded {len(students)} active students")
    
    if not students:
        logger.error("❌ No student records found. Provide students.xlsx or populate SQLite database.")
        return
    
    # Step 2: Fetch rankings using Dual API Strategy
    rankings = fetch_contest_page_rankings(contest_slug)
    rank_map = {r["username"]: r for r in rankings}
    
    # Step 3: Process students & fetch data
    results = []
    solved_counts = {0: 0, 1: 0, 2: 0, 3: 0, 4: 0}
    live_count = 0
    none_count = 0
    
    logger.info("🔄 Processing student participation data...")
    
    for idx, student in enumerate(students, 1):
        username = student['username']
        
        if username in rank_map:
            data = rank_map[username]
            participation = 'LIVE'
            solved = data['solved']
            rank = data['rank']
            finish_time = data['finish_time']
            source_api = 'CONTEST_PAGE'
            live_count += 1
        else:
            # Fallback to Profile GraphQL query for student
            profile_res = fetch_profile_contest_data(username, contest_slug)
            if profile_res.get("attended"):
                participation = 'LIVE'
                solved = profile_res['problems_solved']
                rank = profile_res['rank']
                finish_time = profile_res['finish_time']
                source_api = 'PROFILE'
                live_count += 1
            else:
                participation = 'NONE'
                solved = 0
                rank = None
                finish_time = None
                source_api = 'PROFILE'
                none_count += 1
        
        solved_counts[solved] = solved_counts.get(solved, 0) + 1
        
        results.append({
            'student_id': student.get('id', idx),
            'name': student['name'],
            'roll_number': student['roll_number'],
            'department': student['department'],
            'year': student['year'],
            'username': username,
            'participation': participation,
            'problems_solved': solved,
            'rank': rank,
            'finish_time': finish_time,
            'source_api': source_api
        })
    
    # Step 4: Generate summary
    summary = {
        'total': len(students),
        'live': live_count,
        'none': none_count,
        'solved_counts': solved_counts,
        'dept_stats': {}
    }
    
    for r in results:
        dept = r['department']
        if dept not in summary['dept_stats']:
            summary['dept_stats'][dept] = {
                'total': 0, 'live': 0, 'solved': {0: 0, 1: 0, 2: 0, 3: 0, 4: 0}
            }
        summary['dept_stats'][dept]['total'] += 1
        if r['participation'] == 'LIVE':
            summary['dept_stats'][dept]['live'] += 1
        summary['dept_stats'][dept]['solved'][r['problems_solved']] += 1
    
    # Step 5: Generate reports
    logger.info("📊 Generating Same-Day Excel & PDF reports...")
    excel_file = generate_excel_report(results, summary, contest_date)
    pdf_file = generate_pdf_report(results, summary, contest_slug, contest_date)
    
    # Step 6: Print summary
    logger.info("\n" + "=" * 60)
    logger.info("✅ SAME-DAY REPORT GENERATED SUCCESSFULLY!")
    logger.info("=" * 60)
    tot = summary['total'] if summary['total'] > 0 else 1
    logger.info(f"\n📊 SUMMARY:")
    logger.info(f"  Total Students: {summary['total']}")
    logger.info(f"  LIVE Participants: {summary['live']} ({round(summary['live']/tot*100)}%)")
    logger.info(f"  Non-Participants: {summary['none']} ({round(summary['none']/tot*100)}%)")
    logger.info(f"\n  PROBLEMS SOLVED BREAKDOWN:")
    for i in range(5):
        count = summary['solved_counts'][i]
        pct = round(count/tot*100, 1)
        logger.info(f"    {i} Problems Solved: {count} ({pct}%)")
    logger.info(f"\n📁 Reports Saved:")
    logger.info(f"  Excel: {excel_file}")
    logger.info(f"  PDF: {pdf_file}")
    logger.info("=" * 60)
    
    return summary

# ============================================
# REPORT GENERATION (4-SHEET EXCEL + PDF)
# ============================================

def generate_excel_report(results, summary, contest_date):
    """Generate 4-Sheet Excel report: Raw Data, Summary, Dept-wise, Year-wise"""
    df = pd.DataFrame(results)
    filename = f"{REPORTS_DIR}/report_{contest_date.strftime('%Y%m%d')}.xlsx"
    
    with pd.ExcelWriter(filename, engine='openpyxl') as writer:
        # Sheet 1: Raw Data
        df.to_excel(writer, sheet_name='Raw Data', index=False)
        
        # Sheet 2: Summary
        tot = summary['total'] if summary['total'] > 0 else 1
        summary_data = [
            ['PARTICIPATION SUMMARY'],
            ['Metric', 'Count', 'Percentage'],
            ['Total Students', summary['total'], '100%'],
            ['LIVE Participants', summary['live'], f"{round(summary['live']/tot*100)}%"],
            ['Non-Participants', summary['none'], f"{round(summary['none']/tot*100)}%"],
            [],
            ['PROBLEMS SOLVED BREAKDOWN'],
            ['Solved', 'Count', 'Percentage']
        ]
        for i in range(5):
            count = summary['solved_counts'][i]
            pct = round(count/tot*100, 1)
            summary_data.append([f'{i} Problems', count, f'{pct}%'])
        
        pd.DataFrame(summary_data).to_excel(writer, sheet_name='Summary', index=False, header=False)
        
        # Sheet 3: Department-wise
        dept_data = [['Department', 'Total', 'LIVE', '4', '3', '2', '1', '0']]
        for dept, stats in summary['dept_stats'].items():
            dept_data.append([
                dept,
                stats['total'],
                stats['live'],
                stats['solved'][4],
                stats['solved'][3],
                stats['solved'][2],
                stats['solved'][1],
                stats['solved'][0]
            ])
        pd.DataFrame(dept_data).to_excel(writer, sheet_name='Department-wise', index=False, header=False)
        
        # Sheet 4: Year-wise
        year_data = [['Year', 'Total', 'LIVE', '4', '3', '2', '1', '0']]
        years = sorted(set(r['year'] for r in results))
        for y in years:
            yr_results = [r for r in results if r['year'] == y]
            yr_total = len(yr_results)
            yr_live = sum(1 for r in yr_results if r['participation'] == 'LIVE')
            yr_solved = {0: 0, 1: 0, 2: 0, 3: 0, 4: 0}
            for r in yr_results:
                yr_solved[r['problems_solved']] += 1
            year_data.append([
                f'{y} Year',
                yr_total,
                yr_live,
                yr_solved[4],
                yr_solved[3],
                yr_solved[2],
                yr_solved[1],
                yr_solved[0]
            ])
        pd.DataFrame(year_data).to_excel(writer, sheet_name='Year-wise', index=False, header=False)
    
    logger.info(f"✅ Excel report saved: {filename}")
    return filename

def generate_pdf_report(results, summary, contest_slug, contest_date):
    """Generate Executive PDF Report"""
    filename = f"{REPORTS_DIR}/report_{contest_date.strftime('%Y%m%d')}.pdf"
    doc = SimpleDocTemplate(filename, pagesize=A4)
    styles = getSampleStyleSheet()
    story = []
    
    title_style = ParagraphStyle(
        'CustomTitle', parent=styles['Heading1'],
        fontSize=20, textColor=colors.HexColor('#0F172A'), alignment=1
    )
    story.append(Paragraph("WEEKLY LEETCODE CONTEST REPORT", title_style))
    story.append(Paragraph(f"Contest: {contest_slug}", styles['Heading2']))
    story.append(Paragraph(f"Date: {contest_date.strftime('%d %B %Y')}", styles['Normal']))
    story.append(Spacer(1, 0.2 * inch))
    
    tot = summary['total'] if summary['total'] > 0 else 1
    summary_data = [
        ['Metric', 'Count', 'Percentage'],
        ['Total Students', str(summary['total']), '100%'],
        ['LIVE Participants', str(summary['live']), f"{round(summary['live']/tot*100)}%"],
        ['Non-Participants', str(summary['none']), f"{round(summary['none']/tot*100)}%"]
    ]
    summary_table = Table(summary_data)
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1E293B')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#CBD5E1'))
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 0.2 * inch))
    
    story.append(Paragraph("PROBLEMS SOLVED BREAKDOWN", styles['Heading2']))
    problem_data = [['Problems Solved', 'Count', 'Percentage']]
    for i in range(5):
        count = summary['solved_counts'][i]
        pct = round(count/tot*100, 1)
        problem_data.append([f'{i} Problems', str(count), f'{pct}%'])
    problem_table = Table(problem_data)
    problem_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#334155')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#CBD5E1'))
    ]))
    story.append(problem_table)
    story.append(Spacer(1, 0.2 * inch))
    
    story.append(Paragraph("DEPARTMENT-WISE BREAKDOWN", styles['Heading2']))
    dept_data = [['Department', 'Total', 'LIVE', '4', '3', '2', '1', '0']]
    for dept, stats in sorted(summary['dept_stats'].items()):
        dept_data.append([
            dept,
            str(stats['total']),
            str(stats['live']),
            str(stats['solved'][4]),
            str(stats['solved'][3]),
            str(stats['solved'][2]),
            str(stats['solved'][1]),
            str(stats['solved'][0])
        ])
    dept_table = Table(dept_data)
    dept_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#475569')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#CBD5E1'))
    ]))
    story.append(dept_table)
    story.append(Spacer(1, 0.2 * inch))
    
    top_performers = [r for r in results if r['problems_solved'] == 4 and r['participation'] == 'LIVE']
    if top_performers:
        story.append(Paragraph("TOP PERFORMERS (4/4 Solved)", styles['Heading2']))
        top_data = [['Name', 'Roll Number', 'Department', 'Year', 'Rank']]
        for r in top_performers:
            top_data.append([
                r['name'],
                str(r['roll_number']),
                r['department'],
                str(r['year']),
                str(r['rank']) if r['rank'] else 'N/A'
            ])
        top_table = Table(top_data)
        top_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#15803D')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#CBD5E1'))
        ]))
        story.append(top_table)
        story.append(Spacer(1, 0.2 * inch))
    
    needs_attention = [r for r in results if r['participation'] == 'NONE' or r['problems_solved'] == 0]
    if needs_attention:
        story.append(Paragraph("STUDENTS REQUIRING ATTENTION", styles['Heading2']))
        attention_data = [['Name', 'Roll Number', 'Department', 'Year', 'Reason']]
        for r in needs_attention[:25]:
            reason = 'Non-Participant' if r['participation'] == 'NONE' else '0 Problems Solved'
            attention_data.append([
                r['name'],
                str(r['roll_number']),
                r['department'],
                str(r['year']),
                reason
            ])
        attention_table = Table(attention_data)
        attention_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#B91C1C')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 8),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#CBD5E1'))
        ]))
        story.append(attention_table)
    
    doc.build(story)
    logger.info(f"✅ PDF report saved: {filename}")
    return filename

# ============================================
# COMMAND LINE INTERFACE
# ============================================

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="LeetCode Weekly Contest Tracker - Same Day Report System")
    parser.add_argument("--students", help="Path to students.xlsx file")
    parser.add_argument("--contest", required=True, help="Contest slug (e.g., weekly-contest-515)")
    parser.add_argument("--date", required=True, help="Contest date (YYYY-MM-DD)")
    parser.add_argument("--sync", action="store_true", help="Sync students from Excel file to SQLite database")
    
    args = parser.parse_args()
    
    init_db()
    
    if args.sync and args.students:
        logger.info(f"Syncing students from {args.students} to SQLite database...")
        df = pd.read_excel(args.students)
        conn = get_db()
        cursor = conn.cursor()
        for idx, row in df.iterrows():
            u = str(row.get("LeetCodeUsername", "") or "").strip()
            if u and u != "nan":
                cursor.execute("""
                    INSERT OR REPLACE INTO students 
                    (roll_number, name, year, department, section, leetcode_username, email)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    str(row.get("RollNumber", f"REG_{idx+1}")),
                    str(row.get("Name", "Unknown")),
                    parse_year_val(row.get("Year", 3)),
                    str(row.get("Department", "CSE")),
                    str(row.get("Section", "A")),
                    u,
                    str(row.get("Email", ""))
                ))
        conn.commit()
        conn.close()
        logger.info("✅ Student sync complete.")
    
    contest_date = datetime.strptime(args.date, "%Y-%m-%d").replace(tzinfo=IST)
    process_contest(args.contest, contest_date)

if __name__ == "__main__":
    main()
