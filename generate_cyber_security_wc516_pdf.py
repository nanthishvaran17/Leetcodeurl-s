# generate_cyber_security_wc516_pdf.py
"""
Generates an Authoritative, Executive PDF Report for Cyber Security [CSE(CS)] Department ONLY
Based strictly on Weekly Contest 516 (23.08.2026) in Alphabetical Order.
"""

import os
import sys
import json
import sqlite3
import pandas as pd
import datetime
from zoneinfo import ZoneInfo

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, KeepTogether, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

IST = ZoneInfo("Asia/Kolkata")
EXCEL_PATH = "students.xlsx"
DB_PATH = "data/leetcode_tracker.db"
OUTPUT_PDF = "Cyber_Security_Weekly_Contest_516_Report.pdf"

def main():
    print("=" * 80)
    print("GENERATING CYBER SECURITY [CSE(CS)] WEEKLY CONTEST 516 PDF REPORT")
    print(f"Alphabetical Ordering • Date: 23.08.2026")
    print("=" * 80)

    # 1. Load Cyber Security students from students.xlsx
    df = pd.read_excel(EXCEL_PATH)
    
    # 2. Load Contest 516 results from direct API results / database
    contest_map = {}
    if os.path.exists("contest_516_direct_api_results.json"):
        with open("contest_516_direct_api_results.json", "r", encoding="utf-8") as f:
            c_data = json.load(f)
            for item in c_data:
                reg = str(item.get("reg_no", "")).strip()
                uname = str(item.get("username", "")).strip()
                if reg: contest_map[reg] = item
                if uname: contest_map[uname] = item

    # Also fallback to database for complete 100% resolution
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("""
        SELECT wpr.reg_no, s.username, wpr.participation_status, wpr.total_contest_solved,
               wpr.q1, wpr.q2, wpr.q3, wpr.q4, wpr.contest_rank, wpr.contest_rating
        FROM weekly_public_results wpr
        LEFT JOIN students s ON s.id = wpr.student_id
        WHERE wpr.session_id = 21 AND wpr.dept = 'CSE(CS)'
    """)
    for row in cur.fetchall():
        reg, uname, status, solved, q1, q2, q3, q4, rank, rating = row
        db_item = {
            "is_attended": (status == "PUBLIC" or solved > 0),
            "participation_mode": "LIVE" if status == "PUBLIC" else ("VIRTUAL" if solved > 0 else "NOT_ATTENDED"),
            "total_contest_solved": int(solved or 0),
            "q1": int(q1 or 0), "q2": int(q2 or 0), "q3": int(q3 or 0), "q4": int(q4 or 0),
            "contest_rank": rank, "contest_rating": rating
        }
        if reg and reg not in contest_map:
            contest_map[reg] = db_item
        elif reg and contest_map.get(reg, {}).get("total_contest_solved", 0) < int(solved or 0):
            contest_map[reg].update(db_item)
    conn.close()

    # Filter Cyber Security students
    cs_students = []
    for idx, row in df.iterrows():
        reg = str(row.get("RollNumber", "") or "").strip()
        name = str(row.get("Name", "") or "").strip()
        dept = str(row.get("Department", "") or "").strip().upper()
        year = str(row.get("Year", "") or "").strip().upper()
        uname = str(row.get("LeetCodeUsername", "") or "").strip()
        
        if "CS" in dept or "CYBER" in dept or "CC" in reg.upper():
            if "IOT" in dept or "CI" in reg.upper():
                continue # Skip IoT
            
            c_info = contest_map.get(reg) or contest_map.get(uname) or {}
            solved = c_info.get("total_contest_solved", 0)
            q1 = c_info.get("q1", 0)
            q2 = c_info.get("q2", 0)
            q3 = c_info.get("q3", 0)
            q4 = c_info.get("q4", 0)
            is_att = c_info.get("is_attended", False) or solved > 0
            mode = c_info.get("participation_mode", "NOT_ATTENDED") if is_att else "NOT_ATTENDED"
            if mode == "NOT_ATTENDED" and solved > 0:
                mode = "ATTENDED"
                
            cs_students.append({
                "reg_no": reg,
                "name": name,
                "year": year,
                "username": uname if uname != "nan" else "—",
                "is_attended": is_att,
                "mode": mode,
                "solved": solved,
                "q1": q1,
                "q2": q2,
                "q3": q3,
                "q4": q4
            })

    # Sort strictly in Alphabetical Order by Name (A to Z)
    cs_students.sort(key=lambda s: s["name"].upper())

    total_count = len(cs_students)
    attended_count = sum(1 for s in cs_students if s["is_attended"])
    q4_count = sum(1 for s in cs_students if s["solved"] == 4)
    q3_count = sum(1 for s in cs_students if s["solved"] == 3)
    q2_count = sum(1 for s in cs_students if s["solved"] == 2)
    q1_count = sum(1 for s in cs_students if s["solved"] == 1)
    not_att_count = total_count - attended_count

    print(f"Total Cyber Security Students: {total_count}")
    print(f"Attended: {attended_count} | 4Q: {q4_count} | 3Q: {q3_count} | 2Q: {q2_count} | 1Q: {q1_count} | Not Attended: {not_att_count}")

    # Build ReportLab PDF
    doc = SimpleDocTemplate(
        OUTPUT_PDF,
        pagesize=landscape(A4),
        leftMargin=18,
        rightMargin=18,
        topMargin=18,
        bottomMargin=18
    )

    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'HeaderTitle',
        parent=styles['Heading1'],
        fontSize=13,
        leading=16,
        textColor=colors.HexColor('#0F172A'),
        alignment=1,
        fontName='Helvetica-Bold'
    )
    subtitle_style = ParagraphStyle(
        'HeaderSub',
        parent=styles['Normal'],
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#334155'),
        alignment=1,
        fontName='Helvetica'
    )
    cell_hdr = ParagraphStyle(
        'CellHdr',
        parent=styles['Normal'],
        fontSize=8,
        leading=10,
        textColor=colors.white,
        alignment=1,
        fontName='Helvetica-Bold'
    )
    cell_txt = ParagraphStyle(
        'CellTxt',
        parent=styles['Normal'],
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor('#1E293B'),
        alignment=0,
        fontName='Helvetica'
    )
    cell_center = ParagraphStyle(
        'CellCenter',
        parent=styles['Normal'],
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor('#1E293B'),
        alignment=1,
        fontName='Helvetica'
    )
    cell_green = ParagraphStyle(
        'CellGreen',
        parent=styles['Normal'],
        fontSize=8,
        leading=10,
        textColor=colors.HexColor('#166534'),
        alignment=1,
        fontName='Helvetica-Bold'
    )
    cell_grey = ParagraphStyle(
        'CellGrey',
        parent=styles['Normal'],
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor('#94A3B8'),
        alignment=1,
        fontName='Helvetica'
    )

    story = []

    # Title & Branding
    story.append(Paragraph("<b>NANDHA ENGINEERING COLLEGE (AUTONOMOUS) — ERODE</b>", title_style))
    story.append(Paragraph("<b>DEPARTMENT OF COMPUTER SCIENCE AND ENGINEERING (CYBER SECURITY)</b>", title_style))
    story.append(Paragraph(f"<b>OFFICIAL LEETCODE WEEKLY CONTEST 516 PERFORMANCE REPORT</b> — Date: 23.08.2026 (Sunday 08:00 AM – 09:30 AM IST)", subtitle_style))
    story.append(Paragraph(f"<i>Alphabetical Student Performance Roster (A to Z) • Total Students: {total_count}</i>", subtitle_style))
    story.append(Spacer(1, 6))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#4338CA'), spaceBefore=2, spaceAfter=6))

    # Executive Summary Card Table
    summary_data = [
        [
            Paragraph("<b>Total Students</b>", cell_hdr),
            Paragraph("<b>Participated / Solved</b>", cell_hdr),
            Paragraph("<b>4Q Solved 🏆</b>", cell_hdr),
            Paragraph("<b>3Q Solved 🥇</b>", cell_hdr),
            Paragraph("<b>2Q Solved 🥈</b>", cell_hdr),
            Paragraph("<b>1Q Solved 🥉</b>", cell_hdr),
            Paragraph("<b>Not Attended 🔴</b>", cell_hdr)
        ],
        [
            Paragraph(f"<b>{total_count}</b>", cell_center),
            Paragraph(f"<b>{attended_count} ({round(attended_count/total_count*100, 1)}%)</b>", cell_green),
            Paragraph(f"<b>{q4_count}</b>", cell_center),
            Paragraph(f"<b>{q3_count}</b>", cell_center),
            Paragraph(f"<b>{q2_count}</b>", cell_center),
            Paragraph(f"<b>{q1_count}</b>", cell_center),
            Paragraph(f"<b>{not_att_count}</b>", cell_center)
        ]
    ]
    t_sum = Table(summary_data, colWidths=[110, 140, 110, 110, 110, 110, 110])
    t_sum.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1E293B')),
        ('BACKGROUND', (0, 1), (-1, 1), colors.HexColor('#F8FAFC')),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    story.append(t_sum)
    story.append(Spacer(1, 8))

    # Main Alphabetical Roster Table
    headers = [
        Paragraph("<b>S.No</b>", cell_hdr),
        Paragraph("<b>Student Name (Alphabetical A-Z)</b>", cell_hdr),
        Paragraph("<b>Register No</b>", cell_hdr),
        Paragraph("<b>Year</b>", cell_hdr),
        Paragraph("<b>LeetCode Username</b>", cell_hdr),
        Paragraph("<b>Q1 (3p)</b>", cell_hdr),
        Paragraph("<b>Q2 (4p)</b>", cell_hdr),
        Paragraph("<b>Q3 (5p)</b>", cell_hdr),
        Paragraph("<b>Q4 (6p)</b>", cell_hdr),
        Paragraph("<b>Total Solved</b>", cell_hdr),
        Paragraph("<b>Status / Mode</b>", cell_hdr)
    ]

    table_data = [headers]

    for idx, s in enumerate(cs_students, 1):
        q1_cell = Paragraph("✅ 1", cell_green) if s["q1"] == 1 else Paragraph("—", cell_grey)
        q2_cell = Paragraph("✅ 1", cell_green) if s["q2"] == 1 else Paragraph("—", cell_grey)
        q3_cell = Paragraph("✅ 1", cell_green) if s["q3"] == 1 else Paragraph("—", cell_grey)
        q4_cell = Paragraph("✅ 1", cell_green) if s["q4"] == 1 else Paragraph("—", cell_grey)

        if s["solved"] > 0:
            solved_cell = Paragraph(f"<b>{s['solved']} / 4</b>", cell_green)
            status_cell = Paragraph(f"<b>{s['mode']}</b>", cell_green)
        else:
            solved_cell = Paragraph("0 / 4", cell_grey)
            status_cell = Paragraph("NOT ATTENDED", cell_grey)

        row = [
            Paragraph(str(idx), cell_center),
            Paragraph(f"<b>{s['name']}</b>", cell_txt),
            Paragraph(s["reg_no"], cell_center),
            Paragraph(s["year"], cell_center),
            Paragraph(s["username"], cell_txt),
            q1_cell,
            q2_cell,
            q3_cell,
            q4_cell,
            solved_cell,
            status_cell
        ]
        table_data.append(row)

    # Column widths (Total width = ~800 for landscape A4)
    # [S.No: 28, Name: 175, Reg: 75, Year: 35, Username: 135, Q1: 45, Q2: 45, Q3: 45, Q4: 45, Solved: 65, Status: 110]
    col_widths = [28, 175, 75, 35, 135, 45, 45, 45, 45, 65, 110]
    
    t_roster = Table(table_data, colWidths=col_widths, repeatRows=1)
    
    table_style = [
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0F172A')),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.4, colors.HexColor('#CBD5E1')),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
    ]

    for r_idx in range(1, len(table_data)):
        if r_idx % 2 == 0:
            table_style.append(('BACKGROUND', (0, r_idx), (-1, r_idx), colors.HexColor('#F8FAFC')))
        # Highlight high solvers
        if cs_students[r_idx - 1]["solved"] >= 3:
            table_style.append(('BACKGROUND', (0, r_idx), (-1, r_idx), colors.HexColor('#F0FDF4')))

    t_roster.setStyle(TableStyle(table_style))
    story.append(t_roster)

    doc.build(story)
    print(f"\n✅ PDF Generation Complete: {OUTPUT_PDF} ({os.path.getsize(OUTPUT_PDF):,} bytes)")

if __name__ == "__main__":
    main()
