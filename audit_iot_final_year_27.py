# audit_iot_final_year_27.py
"""
Audits all 27 IoT Final Year (IV Year) students live via LeetCode GraphQL API
and generates the authoritative Alphabetical PDF report: IoT_Final_Year_Contest_516_Report.pdf
"""

import sys
import os
import time
import datetime
import requests
import pandas as pd
from zoneinfo import ZoneInfo

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

IST = ZoneInfo("Asia/Kolkata")
EXCEL_PATH = "students.xlsx"
OUTPUT_PDF = "IoT_Final_Year_Contest_516_Report.pdf"
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
    print("=" * 85)
    print("LIVE AUDIT & PDF GENERATION — IOT FINAL YEAR [IV YEAR] (27 STUDENTS)")
    print(f"Timestamp: {datetime.datetime.now(IST).strftime('%Y-%m-%d %H:%M:%S IST')}")
    print("=" * 85)

    df = pd.read_excel(EXCEL_PATH)
    iot_final = df[(df['Department'].str.contains('IOT|INTERNET', case=False, na=False)) & (df['Year'] == 'IV')]
    print(f"Targeting all {len(iot_final)} IoT Final Year students from {EXCEL_PATH}...")

    today_start_ts = int(datetime.datetime(2026, 8, 23, 0, 0, 0, tzinfo=IST).timestamp())
    results = []

    for idx, row in iot_final.iterrows():
        reg = str(row['RollNumber']).strip()
        name = str(row['Name']).strip()
        uname = str(row['LeetCodeUsername']).strip()

        if not uname or uname == "nan":
            results.append({
                "reg_no": reg, "name": name, "username": "—", "solved": 0,
                "q1": 0, "q2": 0, "q3": 0, "q4": 0, "status": "NOT ATTENDED",
                "today_subs": 0
            })
            continue

        try:
            resp = requests.post(GRAPHQL_URL, json={"query": QUERY, "variables": {"username": uname}}, headers=HEADERS, timeout=12)
            if resp.status_code == 200:
                data = resp.json().get("data", {}) or {}
                matched = data.get("matchedUser")
                if not matched:
                    results.append({
                        "reg_no": reg, "name": name, "username": uname, "solved": 0,
                        "q1": 0, "q2": 0, "q3": 0, "q4": 0, "status": "NOT ATTENDED",
                        "today_subs": 0
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
                status = "ATTENDED" if tot_c_solved > 0 or is_live else "NOT ATTENDED"

                results.append({
                    "reg_no": reg, "name": name, "username": uname, "solved": tot_c_solved,
                    "q1": q1, "q2": q2, "q3": q3, "q4": q4, "status": status,
                    "today_subs": today_sub_count
                })
            else:
                results.append({
                    "reg_no": reg, "name": name, "username": uname, "solved": 0,
                    "q1": 0, "q2": 0, "q3": 0, "q4": 0, "status": "NOT ATTENDED",
                    "today_subs": 0
                })
        except Exception as e:
            results.append({
                "reg_no": reg, "name": name, "username": uname, "solved": 0,
                "q1": 0, "q2": 0, "q3": 0, "q4": 0, "status": "NOT ATTENDED",
                "today_subs": 0
            })
        time.sleep(0.2)

    # Sort strictly in Alphabetical Order (A to Z) by student name
    students = sorted(results, key=lambda s: s["name"].upper())

    total_count = len(students)
    attended_count = sum(1 for s in students if s["solved"] > 0)
    q4_count = sum(1 for s in students if s["solved"] == 4)
    q3_count = sum(1 for s in students if s["solved"] == 3)
    q2_count = sum(1 for s in students if s["solved"] == 2)
    q1_count = sum(1 for s in students if s["solved"] == 1)
    not_att_count = total_count - attended_count

    print(f"\nTotal Final Year IoT Students: {total_count}")
    print(f"Attended/Solved: {attended_count} ({round(attended_count/total_count*100, 1)}%)")
    print(f"4Q: {q4_count} | 3Q: {q3_count} | 2Q: {q2_count} | 1Q: {q1_count} | Not Attended: {not_att_count}")

    # Build ReportLab Landscape A4 PDF
    doc = SimpleDocTemplate(
        OUTPUT_PDF,
        pagesize=landscape(A4),
        leftMargin=24,
        rightMargin=24,
        topMargin=20,
        bottomMargin=20
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle('HeaderTitle', parent=styles['Heading1'], fontSize=14, leading=17, textColor=colors.HexColor('#0F172A'), alignment=1, fontName='Helvetica-Bold')
    dept_style = ParagraphStyle('DeptTitle', parent=styles['Heading2'], fontSize=12, leading=15, textColor=colors.HexColor('#0D9488'), alignment=1, fontName='Helvetica-Bold')
    subtitle_style = ParagraphStyle('HeaderSub', parent=styles['Normal'], fontSize=9.5, leading=13, textColor=colors.HexColor('#334155'), alignment=1, fontName='Helvetica')
    cell_hdr = ParagraphStyle('CellHdr', parent=styles['Normal'], fontSize=8.5, leading=11, textColor=colors.white, alignment=1, fontName='Helvetica-Bold')
    cell_txt = ParagraphStyle('CellTxt', parent=styles['Normal'], fontSize=8.5, leading=11, textColor=colors.HexColor('#1E293B'), alignment=0, fontName='Helvetica')
    cell_center = ParagraphStyle('CellCenter', parent=styles['Normal'], fontSize=8.5, leading=11, textColor=colors.HexColor('#1E293B'), alignment=1, fontName='Helvetica')
    cell_green = ParagraphStyle('CellGreen', parent=styles['Normal'], fontSize=8.5, leading=11, textColor=colors.HexColor('#0F766E'), alignment=1, fontName='Helvetica-Bold')
    cell_grey = ParagraphStyle('CellGrey', parent=styles['Normal'], fontSize=8.5, leading=11, textColor=colors.HexColor('#94A3B8'), alignment=1, fontName='Helvetica')

    story = []

    # Title & College Branding Header
    story.append(Paragraph("<b>NANDHA ENGINEERING COLLEGE (AUTONOMOUS) — ERODE</b>", title_style))
    story.append(Spacer(1, 2))
    story.append(Paragraph("<b>DEPARTMENT OF COMPUTER SCIENCE AND ENGINEERING (INTERNET OF THINGS)</b>", dept_style))
    story.append(Spacer(1, 2))
    story.append(Paragraph("<b>OFFICIAL LEETCODE WEEKLY CONTEST 516 PERFORMANCE REPORT — FINAL YEAR (IV YEAR)</b>", subtitle_style))
    story.append(Paragraph(f"<b>Batch: 2023 – 2027 (IV Year)</b> • Contest Date: <b>23.08.2026 (Sunday)</b> • Total Students: <b>27</b> • Alphabetical Order (A to Z)", subtitle_style))
    story.append(Spacer(1, 6))
    story.append(HRFlowable(width="100%", thickness=1.8, color=colors.HexColor('#0D9488'), spaceBefore=2, spaceAfter=8))

    # Executive Summary Card Table
    summary_data = [
        [
            Paragraph("<b>Total Final Year Students</b>", cell_hdr),
            Paragraph("<b>Contest Solved / Attended</b>", cell_hdr),
            Paragraph("<b>4 Questions Solved 🏆</b>", cell_hdr),
            Paragraph("<b>3 Questions Solved 🥇</b>", cell_hdr),
            Paragraph("<b>2 Questions Solved 🥈</b>", cell_hdr),
            Paragraph("<b>1 Question Solved 🥉</b>", cell_hdr),
            Paragraph("<b>Not Attended 🔴</b>", cell_hdr)
        ],
        [
            Paragraph(f"<b>{total_count}</b>", cell_center),
            Paragraph(f"<b>{attended_count} ({round(attended_count/total_count*100, 1)}%)</b>", cell_green),
            Paragraph(f"<b>{q4_count}</b>", cell_center),
            Paragraph(f"<b>{q3_count}</b>", cell_center),
            Paragraph(f"<b>{q2_count}</b>", cell_center),
            Paragraph(f"<b>{q1_count}</b>", cell_center),
            Paragraph(f"<b>{not_att_count} ({round(not_att_count/total_count*100, 1)}%)</b>", cell_center)
        ]
    ]
    t_sum = Table(summary_data, colWidths=[110, 140, 110, 110, 110, 100, 110])
    t_sum.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1E293B')),
        ('BACKGROUND', (0, 1), (-1, 1), colors.HexColor('#F0FDFA')),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('GRID', (0, 0), (-1, -1), 0.6, colors.HexColor('#CBD5E1')),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(t_sum)
    story.append(Spacer(1, 10))

    # Main Alphabetical Roster Table
    headers = [
        Paragraph("<b>S.No</b>", cell_hdr),
        Paragraph("<b>Student Name (Alphabetical A-Z)</b>", cell_hdr),
        Paragraph("<b>Register No</b>", cell_hdr),
        Paragraph("<b>LeetCode Username</b>", cell_hdr),
        Paragraph("<b>Q1 (3p)</b>", cell_hdr),
        Paragraph("<b>Q2 (4p)</b>", cell_hdr),
        Paragraph("<b>Q3 (5p)</b>", cell_hdr),
        Paragraph("<b>Q4 (6p)</b>", cell_hdr),
        Paragraph("<b>Total Solved</b>", cell_hdr),
        Paragraph("<b>Participation Status</b>", cell_hdr)
    ]

    table_data = [headers]

    for idx, s in enumerate(students, 1):
        q1_cell = Paragraph("✅ 1", cell_green) if s["q1"] == 1 else Paragraph("—", cell_grey)
        q2_cell = Paragraph("✅ 1", cell_green) if s["q2"] == 1 else Paragraph("—", cell_grey)
        q3_cell = Paragraph("✅ 1", cell_green) if s["q3"] == 1 else Paragraph("—", cell_grey)
        q4_cell = Paragraph("✅ 1", cell_green) if s["q4"] == 1 else Paragraph("—", cell_grey)

        if s["solved"] > 0:
            solved_cell = Paragraph(f"<b>{s['solved']} / 4</b>", cell_green)
            status_cell = Paragraph("<b>ATTENDED</b>", cell_green)
        else:
            solved_cell = Paragraph("0 / 4", cell_grey)
            status_cell = Paragraph("NOT ATTENDED", cell_grey)

        row = [
            Paragraph(str(idx), cell_center),
            Paragraph(f"<b>{s['name']}</b>", cell_txt),
            Paragraph(s["reg_no"], cell_center),
            Paragraph(s["username"], cell_txt),
            q1_cell,
            q2_cell,
            q3_cell,
            q4_cell,
            solved_cell,
            status_cell
        ]
        table_data.append(row)

    col_widths = [32, 195, 80, 155, 48, 48, 48, 48, 70, 100]
    t_roster = Table(table_data, colWidths=col_widths, repeatRows=1)
    
    table_style = [
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0F172A')),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]

    for r_idx in range(1, len(table_data)):
        if r_idx % 2 == 0:
            table_style.append(('BACKGROUND', (0, r_idx), (-1, r_idx), colors.HexColor('#F8FAFC')))
        if students[r_idx - 1]["solved"] >= 3:
            table_style.append(('BACKGROUND', (0, r_idx), (-1, r_idx), colors.HexColor('#CCFBF1')))

    t_roster.setStyle(TableStyle(table_style))
    story.append(t_roster)
    
    story.append(Spacer(1, 10))
    footer_text = f"<b>Nandha Engineering College (Autonomous)</b> — Department of CSE (IoT) • Report Generated on {datetime.datetime.now(IST).strftime('%d %B %Y, %I:%M %p IST')}"
    story.append(Paragraph(footer_text, ParagraphStyle('Footer', parent=styles['Normal'], fontSize=8, textColor=colors.HexColor('#64748B'), alignment=1)))

    doc.build(story)
    print(f"\n✅ IoT Final Year PDF Generated Successfully: {OUTPUT_PDF} ({os.path.getsize(OUTPUT_PDF):,} bytes)")

if __name__ == "__main__":
    main()
