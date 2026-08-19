# contest_report.py - UPDATED VERSION
# 100% Accurate Same-Day LeetCode Contest Report System
# Run: python contest_report.py --students students.xlsx --contest weekly-contest-515 --date 2026-08-16

import requests
import pandas as pd
import time
import argparse
from datetime import datetime
from zoneinfo import ZoneInfo
import sys
import os
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch

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
REQUEST_DELAY = 0.2  # seconds between requests
MAX_RETRIES = 2
RETRY_DELAY = 2.0  # seconds between retries

# ============================================
# NEW & ENHANCED API FUNCTIONS
# ============================================

def get_all_contests():
    """Get all contests - PAST, CURRENT, UPCOMING from LeetCode GraphQL API"""
    query = """
    query getContestList {
      allContests {
        title
        titleSlug
        startTime
        duration
      }
    }
    """
    try:
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        }
        response = requests.post(LEETCODE_GRAPHQL_URL, json={"query": query}, headers=headers, timeout=15)
        if response.status_code == 200:
            data = response.json()
            return data.get("data", {}).get("allContests", [])
    except Exception as e:
        print(f"⚠️ Error fetching contest list: {e}")
    return []

def verify_contest_exists(contest_slug):
    """Check if contest exists in LeetCode"""
    try:
        url = f"{CONTEST_API_BASE}/{contest_slug}/"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Referer": f"https://leetcode.com/contest/{contest_slug}/ranking/"
        }
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code == 200:
            return True
        
        # Fallback to allContests GraphQL
        all_contests = get_all_contests()
        slug_clean = contest_slug.lower().strip()
        slug_num = ''.join(filter(str.isdigit, slug_clean))
        for c in all_contests:
            title = c.get("title", "").lower()
            t_slug = c.get("titleSlug", "").lower()
            t_num = ''.join(filter(str.isdigit, title))
            if slug_clean in title or slug_clean in t_slug or (slug_num and slug_num == t_num):
                return True
        return False
    except Exception:
        return True

def get_contest_status(contest_slug):
    """Check if contest is PAST, CURRENT, or UPCOMING"""
    all_contests = get_all_contests()
    slug_clean = contest_slug.lower().strip()
    slug_num = ''.join(filter(str.isdigit, slug_clean))
    
    for contest in all_contests:
        title = contest.get("title", "").lower()
        t_slug = contest.get("titleSlug", "").lower()
        t_num = ''.join(filter(str.isdigit, title))
        
        if slug_clean in title or slug_clean in t_slug or (slug_num and slug_num == t_num):
            now = datetime.now().timestamp()
            if contest["startTime"] > now:
                return "UPCOMING"
            else:
                return "PAST"
    return "PAST"

def fetch_contest_page_rankings(contest_slug):
    """
    ✅ NEW: Fetch from Contest Page API (Leaderboard API)
    ✅ Available: IMMEDIATELY after contest ends on Sunday
    ✅ Returns: username, solved, rank, finish_time
    """
    all_rankings = []
    page = 1
    
    print(f"\n📊 Fetching rankings from Contest Page API...")
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
            print(f"  ⚠️ Error on page {page}: {e}")
            break
    
    print(f"  ✅ Found {len(all_rankings)} leaderboard participants via Contest API")
    return all_rankings

def fetch_profile_contest_data(username, contest_slug, retry_count=0):
    """
    Secondary API Fallback: Fetch contest data from Profile GraphQL API
    """
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
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    try:
        res = requests.post(LEETCODE_GRAPHQL_URL, json=payload, headers=headers, timeout=15)
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
                        "rank": contest.get("ranking", 0),
                        "status": "FOUND",
                        "source": "PROFILE"
                    }
        return {"attended": False, "problems_solved": 0, "status": "NOT_FOUND", "source": "PROFILE"}
    except Exception as e:
        if retry_count < MAX_RETRIES:
            time.sleep(RETRY_DELAY)
            return fetch_profile_contest_data(username, contest_slug, retry_count + 1)
        return {"attended": False, "problems_solved": 0, "status": "DATA_UNAVAILABLE", "error": str(e)}

def classify_participation(attended, finish_time_seconds, contest_date):
    """Classify participation as LIVE or VIRTUAL"""
    if not attended:
        return "NONE", None
    
    # Contest duration window (1.5 hours = 5400 seconds)
    if (finish_time_seconds or 0) <= 5400:
        return "LIVE", finish_time_seconds
    else:
        return "VIRTUAL", finish_time_seconds

# ============================================
# MAIN DATA PROCESSING ENGINE
# ============================================

def process_student_data(student_df, contest_slug, contest_date):
    """
    ✅ Process all students - Uses Same-Day Contest Page API + Profile Fallback
    """
    if not verify_contest_exists(contest_slug):
        print(f"\n❌ Contest '{contest_slug}' does not exist on LeetCode")
        return pd.DataFrame()
    
    status = get_contest_status(contest_slug)
    if status == "UPCOMING":
        print(f"\n📅 '{contest_slug}' is UPCOMING.")
        print(f"   Please run this script after Sunday 9:30 AM IST when the contest ends.")
        return pd.DataFrame()
    
    # Step 1: Fetch Contest Page API rankings (Same Day)
    all_rankings = fetch_contest_page_rankings(contest_slug)
    rank_map = {r["username"]: r for r in all_rankings}
    
    results = []
    total = len(student_df)
    
    print(f"\n📊 Processing {total} students for {contest_slug}...")
    print("=" * 60)
    
    for idx, row in student_df.iterrows():
        username = str(row.get('LeetCodeUsername', '') or '').strip()
        name = row.get('Name', 'Unknown')
        roll = row.get('RollNumber', '')
        dept = row.get('Department', 'Unknown')
        year = row.get('Year', 0)
        
        if not username or username == 'nan':
            results.append({
                'Name': name,
                'RollNumber': roll,
                'Department': dept,
                'Year': year,
                'LeetCodeUsername': username,
                'Attended': False,
                'ProblemsSolved': 0,
                'FinishTime': None,
                'Rank': None,
                'Participation': 'DATA_UNAVAILABLE',
                'Status': 'NO_USERNAME'
            })
            continue
        
        # Primary Same-Day Check: Contest Page API
        if username in rank_map:
            data = rank_map[username]
            participation, finish = classify_participation(True, data["finish_time"], contest_date)
            
            results.append({
                'Name': name,
                'RollNumber': roll,
                'Department': dept,
                'Year': year,
                'LeetCodeUsername': username,
                'Attended': True,
                'ProblemsSolved': data["solved"],
                'FinishTime': data["finish_time"],
                'Rank': data["rank"],
                'Participation': participation,
                'Status': 'ATTENDED'
            })
            print(f"  {idx+1}/{total}: {username} ({name})")
            print(f"    ✅ {participation} | {data['solved']}/4 solved | Rank: {data['rank']}")
        else:
            # Secondary Fallback Check: Profile GraphQL API
            prof_data = fetch_profile_contest_data(username, contest_slug)
            if prof_data.get("attended"):
                participation, finish = classify_participation(True, prof_data["finish_time"], contest_date)
                results.append({
                    'Name': name,
                    'RollNumber': roll,
                    'Department': dept,
                    'Year': year,
                    'LeetCodeUsername': username,
                    'Attended': True,
                    'ProblemsSolved': prof_data["problems_solved"],
                    'FinishTime': prof_data["finish_time"],
                    'Rank': prof_data["rank"],
                    'Participation': participation,
                    'Status': 'ATTENDED'
                })
                print(f"  {idx+1}/{total}: {username} ({name})")
                print(f"    ✅ {participation} (Profile API) | {prof_data['problems_solved']}/4 solved | Rank: {prof_data['rank']}")
            else:
                results.append({
                    'Name': name,
                    'RollNumber': roll,
                    'Department': dept,
                    'Year': year,
                    'LeetCodeUsername': username,
                    'Attended': False,
                    'ProblemsSolved': 0,
                    'FinishTime': None,
                    'Rank': None,
                    'Participation': 'NONE',
                    'Status': 'NOT_ATTENDED'
                })
                print(f"  {idx+1}/{total}: {username} ({name})")
                print(f"    ⚪ Not attended")
        
        time.sleep(REQUEST_DELAY)
    
    return pd.DataFrame(results)

# ============================================
# SUMMARY & EXPORT ENGINE
# ============================================

def generate_summary(df):
    """Generate summary statistics from results"""
    total = len(df)
    live = len(df[df['Participation'] == 'LIVE'])
    virtual = len(df[df['Participation'] == 'VIRTUAL'])
    none = len(df[df['Participation'] == 'NONE'])
    data_unavailable = len(df[df['Participation'] == 'DATA_UNAVAILABLE'])
    
    solved = {}
    for i in range(5):
        solved[i] = len(df[df['ProblemsSolved'] == i])
    
    dept_stats = {}
    for dept in df['Department'].unique():
        dept_df = df[df['Department'] == dept]
        dept_stats[dept] = {
            'total': len(dept_df),
            'live': len(dept_df[dept_df['Participation'] == 'LIVE']),
            'virtual': len(dept_df[dept_df['Participation'] == 'VIRTUAL']),
            'none': len(dept_df[dept_df['Participation'] == 'NONE']),
            'solved_4': len(dept_df[dept_df['ProblemsSolved'] == 4]),
            'solved_3': len(dept_df[dept_df['ProblemsSolved'] == 3]),
            'solved_2': len(dept_df[dept_df['ProblemsSolved'] == 2]),
            'solved_1': len(dept_df[dept_df['ProblemsSolved'] == 1]),
            'solved_0': len(dept_df[dept_df['ProblemsSolved'] == 0])
        }
    
    year_stats = {}
    for y in df['Year'].unique():
        y_df = df[df['Year'] == y]
        year_stats[y] = {
            'total': len(y_df),
            'live': len(y_df[y_df['Participation'] == 'LIVE']),
            'virtual': len(y_df[y_df['Participation'] == 'VIRTUAL']),
            'none': len(y_df[y_df['Participation'] == 'NONE']),
            'solved_4': len(y_df[y_df['ProblemsSolved'] == 4]),
            'solved_3': len(y_df[y_df['ProblemsSolved'] == 3]),
            'solved_2': len(y_df[y_df['ProblemsSolved'] == 2]),
            'solved_1': len(y_df[y_df['ProblemsSolved'] == 1]),
            'solved_0': len(y_df[y_df['ProblemsSolved'] == 0])
        }
    
    top_performers = df[(df['ProblemsSolved'] == 4) & (df['Participation'] == 'LIVE')]
    needs_attention = df[(df['Participation'] == 'NONE') | (df['ProblemsSolved'] == 0) | (df['Participation'] == 'DATA_UNAVAILABLE')]
    
    return {
        'total': total,
        'live': live,
        'virtual': virtual,
        'none': none,
        'data_unavailable': data_unavailable,
        'solved': solved,
        'dept_stats': dept_stats,
        'year_stats': year_stats,
        'top_performers': top_performers,
        'needs_attention': needs_attention
    }

def export_excel(df, summary, contest_date):
    """Export results to Excel report with Raw Data + Summary Pivot sheets"""
    output_file = f"report_{contest_date.strftime('%Y-%m-%d')}.xlsx"
    
    with pd.ExcelWriter(output_file, engine='openpyxl') as writer:
        df.to_excel(writer, sheet_name='Raw Data', index=False)
        
        tot = summary['total'] if summary['total'] > 0 else 1
        summary_data = [
            ['OVERALL PARTICIPATION SUMMARY'],
            ['Metric', 'Count', 'Percentage'],
            ['Total Students', summary['total'], '100%'],
            ['LIVE Participants', summary['live'], f"{round(summary['live']/tot*100)}%"],
            ['VIRTUAL Participants', summary['virtual'], f"{round(summary['virtual']/tot*100)}%"],
            ['Non-Participants', summary['none'], f"{round(summary['none']/tot*100)}%"],
            ['Data Unavailable', summary['data_unavailable'], f"{round(summary['data_unavailable']/tot*100)}%"],
            [],
            ['PROBLEMS SOLVED BREAKDOWN'],
            ['Solved', 'Students', 'Percentage']
        ]
        for i in range(5):
            count = summary['solved'][i]
            pct = round(count / tot * 100)
            summary_data.append([f'{i} Problems', count, f'{pct}%'])
            
        summary_data.append([])
        summary_data.append(['DEPARTMENT-WISE BREAKDOWN'])
        header = ['Department', 'Total', 'Live', 'Virtual', '4 Solved', '3 Solved', '2 Solved', '1 Solved', '0 Solved']
        summary_data.append(header)
        for dept, stats in summary['dept_stats'].items():
            summary_data.append([
                dept, stats['total'], stats['live'], stats['virtual'],
                stats['solved_4'], stats['solved_3'], stats['solved_2'], stats['solved_1'], stats['solved_0']
            ])
            
        pd.DataFrame(summary_data).to_excel(writer, sheet_name='Summary Pivot', index=False, header=False)
    
    print(f"\n📁 Excel report saved: {output_file}")
    return output_file

def export_pdf(df, summary, contest_date, output_file):
    """Export summary report to PDF for Sir"""
    doc = SimpleDocTemplate(output_file, pagesize=A4)
    styles = getSampleStyleSheet()
    story = []
    
    title_style = ParagraphStyle(
        'CustomTitle', parent=styles['Heading1'],
        fontSize=18, textColor=colors.HexColor('#0F172A'), alignment=1
    )
    story.append(Paragraph("WEEKLY LEETCODE CONTEST REPORT", title_style))
    story.append(Paragraph(f"Contest Date: {contest_date.strftime('%Y-%m-%d')}", styles['Heading2']))
    story.append(Spacer(1, 0.2 * inch))
    
    tot = summary['total'] if summary['total'] > 0 else 1
    summary_data = [
        ['Metric', 'Count', 'Percentage'],
        ['Total Students', str(summary['total']), '100%'],
        ['Live Participants', str(summary['live']), f"{round(summary['live']/tot*100)}%"],
        ['Virtual Participants', str(summary['virtual']), f"{round(summary['virtual']/tot*100)}%"],
        ['Non-Participants', str(summary['none']), f"{round(summary['none']/tot*100)}%"],
        ['Data Unavailable', str(summary['data_unavailable']), f"{round(summary['data_unavailable']/tot*100)}%"]
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
    problem_data = [['Problems Solved', 'Students', 'Percentage']]
    for i in range(5):
        count = summary['solved'][i]
        pct = round(count / tot * 100)
        problem_data.append([f'{i} Problem{"s" if i != 1 else ""}', str(count), f'{pct}%'])
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
    dept_data = [['Department', 'Total', 'Live', 'Virtual', '4', '3', '2', '1', '0']]
    for dept, stats in summary['dept_stats'].items():
        dept_data.append([
            dept, str(stats['total']), str(stats['live']), str(stats['virtual']),
            str(stats['solved_4']), str(stats['solved_3']), str(stats['solved_2']), str(stats['solved_1']), str(stats['solved_0'])
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
    
    if len(summary['top_performers']) > 0:
        story.append(Paragraph("TOP PERFORMERS (4/4 Solved - LIVE)", styles['Heading2']))
        top_data = [['Name', 'Roll Number', 'Department', 'Year', 'Rank']]
        for _, row in summary['top_performers'].iterrows():
            top_data.append([
                str(row['Name']), str(row['RollNumber']), str(row['Department']), str(row['Year']), str(row['Rank']) if row['Rank'] else 'N/A'
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
    
    if len(summary['needs_attention']) > 0:
        story.append(Paragraph("STUDENTS REQUIRING ATTENTION", styles['Heading2']))
        attention_data = [['Name', 'Roll Number', 'Department', 'Year', 'Reason']]
        for _, row in summary['needs_attention'].iloc[:25].iterrows():
            if row['Participation'] == 'DATA_UNAVAILABLE':
                reason = 'Data Unavailable'
            elif row['Participation'] == 'NONE':
                reason = 'Non-Participant'
            elif row['ProblemsSolved'] == 0:
                reason = '0 Problems Solved'
            else:
                reason = 'Needs Review'
            attention_data.append([
                str(row['Name']), str(row['RollNumber']), str(row['Department']), str(row['Year']), reason
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
    print(f"📄 PDF report saved: {output_file}")
    return output_file

# ============================================
# CLI MAIN FUNCTION
# ============================================

def main():
    parser = argparse.ArgumentParser(description="LeetCode Weekly Contest Tracker - Same Day Engine")
    parser.add_argument('--students', required=True, help="Path to students.xlsx file")
    parser.add_argument('--contest', required=True, help="Contest slug (e.g., weekly-contest-515)")
    parser.add_argument('--date', required=True, help="Contest date (YYYY-MM-DD)")
    args = parser.parse_args()
    
    print("\n" + "=" * 70)
    print("  LEETCODE WEEKLY CONTEST TRACKER - SAME DAY ENGINE")
    print("=" * 70)
    print(f"  📁 Students: {args.students}")
    print(f"  🏆 Contest: {args.contest}")
    print(f"  📅 Date: {args.date}")
    print("=" * 70)
    
    if not os.path.exists(args.students):
        print(f"❌ Error: Students file not found: {args.students}")
        sys.exit(1)
    
    try:
        df = pd.read_excel(args.students)
        print(f"\n✅ Loaded {len(df)} students from {args.students}")
    except Exception as e:
        print(f"❌ Error loading excel file: {e}")
        sys.exit(1)
    
    contest_date = datetime.strptime(args.date, "%Y-%m-%d").replace(tzinfo=IST)
    results = process_student_data(df, args.contest, contest_date)
    
    if results.empty:
        return
    
    summary = generate_summary(results)
    excel_file = export_excel(results, summary, contest_date)
    pdf_file = f"report_{contest_date.strftime('%Y-%m-%d')}.pdf"
    export_pdf(results, summary, contest_date, pdf_file)
    
    tot = summary['total'] if summary['total'] > 0 else 1
    print("\n" + "=" * 70)
    print("  ✅ SAME-DAY REPORT GENERATED SUCCESSFULLY")
    print("=" * 70)
    print(f"\n📊 Summary:")
    print(f"  Total Students: {summary['total']}")
    print(f"  LIVE Participants: {summary['live']} ({round(summary['live']/tot*100)}%)")
    print(f"  VIRTUAL Participants: {summary['virtual']} ({round(summary['virtual']/tot*100)}%)")
    print(f"  Non-Participants: {summary['none']} ({round(summary['none']/tot*100)}%)")
    print(f"  Data Unavailable: {summary['data_unavailable']} ({round(summary['data_unavailable']/tot*100)}%)")
    print(f"\n📁 Outputs:")
    print(f"  Excel: {excel_file}")
    print(f"  PDF:   {pdf_file}")
    print("\n" + "=" * 70)

if __name__ == "__main__":
    main()
