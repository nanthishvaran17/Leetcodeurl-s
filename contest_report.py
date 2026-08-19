# contest_report.py
# LeetCode Weekly Contest Tracker - Standalone Production Script
# Run: python contest_report.py --students students.xlsx --contest weekly-contest-421 --date 2026-08-16

import pandas as pd
import requests
import json
import time
import argparse
from datetime import datetime, timedelta
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
import sys
import os

# ============================================
# CONFIGURATION
# ============================================

LEETCODE_GRAPHQL_URL = "https://leetcode.com/graphql"
REQUEST_DELAY = 1.0  # seconds between requests
MAX_RETRIES = 2
RETRY_DELAY = 2.0  # seconds between retries

# ============================================
# LEETCODE API - GRAPHQL QUERIES
# ============================================

ALL_CONTESTS_QUERY = """
query getContestList {
  allContests {
    title
    titleSlug
    startTime
    duration
  }
}
"""

USER_CONTEST_RANKING_QUERY = """
query userContestRankingInfo($username: String!) {
  userContestRanking(username: $username) {
    attendedContestsCount
    rating
    globalRanking
    totalParticipants
    topPercentage
    badge {
      name
    }
  }
  userContestRankingHistory(username: $username) {
    attended
    totalProblems
    problemsSolved
    finishTimeInSeconds
    rating
    ranking
    contest {
      title
      startTime
    }
  }
}
"""

# ============================================
# FETCH FUNCTIONS
# ============================================

def get_all_contests():
    """
    Fetch master list of all contests from LeetCode GraphQL API.
    Returns: list of dicts with title, titleSlug, startTime, duration
    """
    try:
        payload = {"query": ALL_CONTESTS_QUERY}
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        res = requests.post(LEETCODE_GRAPHQL_URL, json=payload, headers=headers, timeout=15)
        if res.status_code == 200:
            return res.json().get("data", {}).get("allContests", [])
    except Exception as e:
        print(f"  ⚠️ Warning: Failed to fetch master contest list from LeetCode: {e}")
    return []

def fetch_contest_data(username, contest_slug, retry_count=0):
    """
    Fetch contest data for a specific user and contest.
    Returns: (attended, problems_solved, finish_time, rank, status)
    """
    try:
        payload = {
            "query": USER_CONTEST_RANKING_QUERY,
            "variables": {"username": username}
        }
        
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        
        response = requests.post(
            LEETCODE_GRAPHQL_URL,
            json=payload,
            headers=headers,
            timeout=15
        )
        
        if response.status_code != 200:
            raise Exception(f"HTTP {response.status_code}")
        
        data = response.json()
        
        if "errors" in data:
            raise Exception(f"GraphQL Error: {data['errors']}")
        
        history = data.get("data", {}).get("userContestRankingHistory", [])
        if not history:
            history = []
        
        slug_clean = contest_slug.lower().strip()
        slug_num = ''.join(filter(str.isdigit, slug_clean))
        
        for contest in history:
            contest_title = contest.get("contest", {}).get("title", "")
            title_slug = contest_title.replace(" ", "-").lower()
            title_num = ''.join(filter(str.isdigit, contest_title))
            
            # Match by slug, title substring, or exact contest number
            if (slug_clean in contest_title.lower() or 
                slug_clean in title_slug or 
                (slug_num and slug_num == title_num)):
                
                attended = contest.get("attended", False)
                problems_solved = contest.get("problemsSolved", 0)
                finish_time_seconds = contest.get("finishTimeInSeconds", 0)
                ranking = contest.get("ranking", 0)
                
                return {
                    "attended": attended,
                    "problems_solved": problems_solved if attended else 0,
                    "finish_time": finish_time_seconds,
                    "rank": ranking,
                    "status": "FOUND"
                }
        
        # Contest exists on LeetCode but user did not attend
        return {
            "attended": False,
            "problems_solved": 0,
            "finish_time": None,
            "rank": None,
            "status": "NOT_FOUND"
        }
        
    except Exception as e:
        if retry_count < MAX_RETRIES:
            print(f"  ⚠️ Retry {retry_count + 1}/{MAX_RETRIES} for {username}: {str(e)}")
            time.sleep(RETRY_DELAY)
            return fetch_contest_data(username, contest_slug, retry_count + 1)
        else:
            print(f"  ❌ Failed for {username}: {str(e)}")
            return {
                "attended": False,
                "problems_solved": 0,
                "finish_time": None,
                "rank": None,
                "status": "DATA_UNAVAILABLE",
                "error": str(e)
            }

def classify_participation(attended, finish_time_seconds):
    """
    Classify participation as LIVE, VIRTUAL, or NONE.
    Contest: 8:00 AM to 9:30 AM IST (1.5 hours = 5400 seconds)
    """
    if not attended:
        return "NONE", None
    
    finish_hours = (finish_time_seconds or 0) / 3600.0
    
    if finish_hours <= 1.5:
        return "LIVE", finish_hours
    else:
        return "VIRTUAL", finish_hours

# ============================================
# DATA PROCESSING
# ============================================

def process_student_data(student_df, contest_slug, contest_date):
    """
    Process all students and fetch contest data.
    """
    results = []
    
    print(f"\n📊 Processing {len(student_df)} students for {contest_slug}...")
    print("=" * 60)
    
    for idx, row in student_df.iterrows():
        username = str(row.get('LeetCodeUsername', '') or '').strip()
        name = row.get('Name', 'Unknown')
        roll = row.get('RollNumber', '')
        dept = row.get('Department', 'Unknown')
        year = row.get('Year', 0)
        
        if not username or username == 'nan':
            print(f"  ⚠️ Row {idx+1}: No username for {name}")
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
        
        print(f"  {idx+1}/{len(student_df)}: {username} ({name})")
        
        data = fetch_contest_data(username, contest_slug)
        
        if data['status'] == 'DATA_UNAVAILABLE':
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
                'Status': 'FETCH_FAILED'
            })
            print(f"    ❌ Data unavailable")
        elif data['status'] == 'NOT_FOUND':
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
            print(f"    ⚪ Not attended")
        else:
            attended = data['attended']
            finish_time = data['finish_time']
            problems_solved = data['problems_solved']
            rank = data['rank']
            
            if not attended:
                participation = 'NONE'
                status = 'NOT_ATTENDED'
            else:
                participation, finish_hours = classify_participation(attended, finish_time)
                status = 'ATTENDED'
            
            results.append({
                'Name': name,
                'RollNumber': roll,
                'Department': dept,
                'Year': year,
                'LeetCodeUsername': username,
                'Attended': attended,
                'ProblemsSolved': problems_solved,
                'FinishTime': finish_time,
                'Rank': rank,
                'Participation': participation,
                'Status': status
            })
            
            if participation == 'LIVE':
                print(f"    ✅ LIVE | {problems_solved}/4 solved | Rank: {rank}")
            elif participation == 'VIRTUAL':
                print(f"    🟣 VIRTUAL | {problems_solved}/4 solved | Rank: {rank}")
            else:
                print(f"    ⚪ Not attended")
        
        time.sleep(REQUEST_DELAY)
    
    return pd.DataFrame(results)

# ============================================
# SUMMARY GENERATION
# ============================================

def generate_summary(df):
    """
    Generate summary statistics from processed data.
    """
    total_students = len(df)
    live = len(df[df['Participation'] == 'LIVE'])
    virtual = len(df[df['Participation'] == 'VIRTUAL'])
    none = len(df[df['Participation'] == 'NONE'])
    data_unavailable = len(df[df['Participation'] == 'DATA_UNAVAILABLE'])
    
    solved_counts = {
        0: len(df[df['ProblemsSolved'] == 0]),
        1: len(df[df['ProblemsSolved'] == 1]),
        2: len(df[df['ProblemsSolved'] == 2]),
        3: len(df[df['ProblemsSolved'] == 3]),
        4: len(df[df['ProblemsSolved'] == 4])
    }
    
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
    for year in df['Year'].unique():
        year_df = df[df['Year'] == year]
        year_stats[year] = {
            'total': len(year_df),
            'live': len(year_df[year_df['Participation'] == 'LIVE']),
            'virtual': len(year_df[year_df['Participation'] == 'VIRTUAL']),
            'none': len(year_df[year_df['Participation'] == 'NONE']),
            'solved_4': len(year_df[year_df['ProblemsSolved'] == 4]),
            'solved_3': len(year_df[year_df['ProblemsSolved'] == 3]),
            'solved_2': len(year_df[year_df['ProblemsSolved'] == 2]),
            'solved_1': len(year_df[year_df['ProblemsSolved'] == 1]),
            'solved_0': len(year_df[year_df['ProblemsSolved'] == 0])
        }
    
    top_performers = df[(df['ProblemsSolved'] == 4) & (df['Participation'] == 'LIVE')]
    
    needs_attention = df[
        (df['Participation'] == 'NONE') | 
        (df['ProblemsSolved'] == 0) | 
        (df['Participation'] == 'DATA_UNAVAILABLE')
    ]
    
    return {
        'total': total_students,
        'live': live,
        'virtual': virtual,
        'none': none,
        'data_unavailable': data_unavailable,
        'solved_counts': solved_counts,
        'dept_stats': dept_stats,
        'year_stats': year_stats,
        'top_performers': top_performers,
        'needs_attention': needs_attention
    }

# ============================================
# EXCEL EXPORT
# ============================================

def export_excel(df, summary, contest_date, output_file):
    """
    Export data to Excel with two sheets.
    """
    with pd.ExcelWriter(output_file, engine='openpyxl') as writer:
        df.to_excel(writer, sheet_name='Raw Data', index=False)
        
        summary_data = []
        summary_data.append(['OVERALL SUMMARY'])
        summary_data.append(['Metric', 'Count'])
        summary_data.append(['Total Students', summary['total']])
        summary_data.append(['Live Participants', summary['live']])
        summary_data.append(['Virtual Participants', summary['virtual']])
        summary_data.append(['Non-Participants', summary['none']])
        summary_data.append(['Data Unavailable', summary['data_unavailable']])
        summary_data.append([])
        
        summary_data.append(['PROBLEMS SOLVED BREAKDOWN'])
        summary_data.append(['Solved', 'Students'])
        for i in range(5):
            summary_data.append([f'{i} Problems', summary['solved_counts'][i]])
        summary_data.append([])
        
        summary_data.append(['DEPARTMENT-WISE BREAKDOWN'])
        header = ['Department', 'Total', 'Live', 'Virtual', '4 Solved', '3 Solved', '2 Solved', '1 Solved', '0 Solved']
        summary_data.append(header)
        for dept, stats in summary['dept_stats'].items():
            summary_data.append([
                dept,
                stats['total'],
                stats['live'],
                stats['virtual'],
                stats['solved_4'],
                stats['solved_3'],
                stats['solved_2'],
                stats['solved_1'],
                stats['solved_0']
            ])
        summary_data.append([])
        
        summary_data.append(['YEAR-WISE BREAKDOWN'])
        summary_data.append(header)
        for year in sorted(summary['year_stats'].keys()):
            stats = summary['year_stats'][year]
            summary_data.append([
                f'{year} Year',
                stats['total'],
                stats['live'],
                stats['virtual'],
                stats['solved_4'],
                stats['solved_3'],
                stats['solved_2'],
                stats['solved_1'],
                stats['solved_0']
            ])
        
        summary_df = pd.DataFrame(summary_data)
        summary_df.to_excel(writer, sheet_name='Summary Pivot', index=False, header=False)

# ============================================
# PDF EXPORT
# ============================================

def export_pdf(df, summary, contest_date, output_file):
    """
    Export summary report to PDF.
    """
    doc = SimpleDocTemplate(output_file, pagesize=A4)
    styles = getSampleStyleSheet()
    story = []
    
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=18,
        textColor=colors.HexColor('#0F172A'),
        alignment=1
    )
    story.append(Paragraph("WEEKLY LEETCODE CONTEST REPORT", title_style))
    story.append(Paragraph(f"Contest Date: {contest_date}", styles['Heading2']))
    story.append(Spacer(1, 0.2 * inch))
    
    story.append(Paragraph("PARTICIPATION SUMMARY", styles['Heading2']))
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
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#CBD5E1'))
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 0.2 * inch))
    
    story.append(Paragraph("PROBLEMS SOLVED BREAKDOWN", styles['Heading2']))
    problem_data = [
        ['Problems Solved', 'Students', 'Percentage']
    ]
    for i in range(5):
        count = summary['solved_counts'][i]
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
    dept_data = [
        ['Department', 'Total', 'Live', 'Virtual', '4', '3', '2', '1', '0']
    ]
    for dept, stats in summary['dept_stats'].items():
        dept_data.append([
            dept,
            str(stats['total']),
            str(stats['live']),
            str(stats['virtual']),
            str(stats['solved_4']),
            str(stats['solved_3']),
            str(stats['solved_2']),
            str(stats['solved_1']),
            str(stats['solved_0'])
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
    
    story.append(Paragraph("YEAR-WISE BREAKDOWN", styles['Heading2']))
    year_data = [
        ['Year', 'Total', 'Live', 'Virtual', '4', '3', '2', '1', '0']
    ]
    for year in sorted(summary['year_stats'].keys()):
        stats = summary['year_stats'][year]
        year_data.append([
            f'{year} Year',
            str(stats['total']),
            str(stats['live']),
            str(stats['virtual']),
            str(stats['solved_4']),
            str(stats['solved_3']),
            str(stats['solved_2']),
            str(stats['solved_1']),
            str(stats['solved_0'])
        ])
    year_table = Table(year_data)
    year_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#475569')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#CBD5E1'))
    ]))
    story.append(year_table)
    story.append(Spacer(1, 0.2 * inch))
    
    if len(summary['top_performers']) > 0:
        story.append(Paragraph("TOP PERFORMERS (4/4 Solved - LIVE)", styles['Heading2']))
        top_data = [
            ['Name', 'Roll Number', 'Department', 'Year', 'Rank']
        ]
        for _, row in summary['top_performers'].iterrows():
            top_data.append([
                str(row['Name']),
                str(row['RollNumber']),
                str(row['Department']),
                str(row['Year']),
                str(row['Rank']) if row['Rank'] else 'N/A'
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
        attention_data = [
            ['Name', 'Roll Number', 'Department', 'Year', 'Reason']
        ]
        for _, row in summary['needs_attention'].iterrows():
            if row['Participation'] == 'DATA_UNAVAILABLE':
                reason = 'Data Unavailable'
            elif row['Participation'] == 'NONE':
                reason = 'Non-Participant'
            elif row['ProblemsSolved'] == 0:
                reason = '0 Problems Solved'
            else:
                reason = 'Needs Review'
            attention_data.append([
                str(row['Name']),
                str(row['RollNumber']),
                str(row['Department']),
                str(row['Year']),
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
    print(f"  📄 PDF saved: {output_file}")

# ============================================
# MAIN SCRIPT
# ============================================

def main():
    parser = argparse.ArgumentParser(description='LeetCode Weekly Contest Tracker')
    parser.add_argument('--students', required=True, help='Path to students.xlsx file')
    parser.add_argument('--contest', required=True, help='Contest slug (e.g., weekly-contest-421)')
    parser.add_argument('--date', required=True, help='Contest date (e.g., 2026-08-16)')
    args = parser.parse_args()
    
    print("\n" + "="*70)
    print("  LEETCODE WEEKLY CONTEST TRACKER - STANDALONE ENGINE")
    print("="*70)
    print(f"  📁 Students File: {args.students}")
    print(f"  🏆 Contest: {args.contest}")
    print(f"  📅 Date: {args.date}")
    print("="*70)
    
    if not os.path.exists(args.students):
        print(f"❌ Error: Students file not found: {args.students}")
        sys.exit(1)
    
    print(f"\n📖 Loading students from {args.students}...")
    try:
        student_df = pd.read_excel(args.students)
        print(f"  ✅ Loaded {len(student_df)} students")
    except Exception as e:
        print(f"❌ Error loading students file: {e}")
        sys.exit(1)
    
    print("\n🌐 Verifying contest with LeetCode Master Contest List...")
    all_contests = get_all_contests()
    if all_contests:
        matched_contest = None
        for c in all_contests:
            slug = c.get("titleSlug", "")
            title = c.get("title", "")
            if args.contest.lower() in slug.lower() or args.contest.lower() in title.lower() or ''.join(filter(str.isdigit, args.contest)) == ''.join(filter(str.isdigit, title)):
                matched_contest = c
                break
        if matched_contest:
            print(f"  ✅ Verified Contest: {matched_contest['title']} (Slug: {matched_contest['titleSlug']})")
        else:
            print(f"  ℹ️ Contest '{args.contest}' not in top recent master list; proceeding with student history scan...")

    contest_date = datetime.strptime(args.date, "%Y-%m-%d")
    results_df = process_student_data(student_df, args.contest, contest_date)
    
    print("\n📊 Generating summary...")
    summary = generate_summary(results_df)
    
    excel_file = f"report_{args.date}.xlsx"
    print(f"\n📁 Exporting Excel: {excel_file}")
    export_excel(results_df, summary, args.date, excel_file)
    
    pdf_file = f"report_{args.date}.pdf"
    print(f"📄 Exporting PDF: {pdf_file}")
    export_pdf(results_df, summary, args.date, pdf_file)
    
    print("\n" + "="*70)
    print("  ✅ REPORT GENERATED SUCCESSFULLY")
    print("="*70)
    tot = summary['total'] if summary['total'] > 0 else 1
    print(f"\n  📊 Summary:")
    print(f"    Total Students: {summary['total']}")
    print(f"    Live: {summary['live']} ({round(summary['live']/tot*100)}%)")
    print(f"    Virtual: {summary['virtual']} ({round(summary['virtual']/tot*100)}%)")
    print(f"    Non-Participants: {summary['none']} ({round(summary['none']/tot*100)}%)")
    print(f"    Data Unavailable: {summary['data_unavailable']} ({round(summary['data_unavailable']/tot*100)}%)")
    print(f"\n  📁 Outputs:")
    print(f"    Excel: {excel_file}")
    print(f"    PDF: {pdf_file}")
    print("\n" + "="*70)

if __name__ == "__main__":
    main()
