# generate_cyber_final_year_pdf.py
"""
Generates an Executive PDF Report for Cyber Security FINAL YEAR (IV Year — 28 Students) ONLY
Based strictly on Weekly Contest 516 (23.08.2026) in Alphabetical Order (A to Z).
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
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

IST = ZoneInfo("Asia/Kolkata")
EXCEL_PATH = "students.xlsx"
OUTPUT_PDF = "Cyber_Security_Final_Year_Contest_516_Report.pdf"

# Verified Live/Practice Solves for the 28 Cyber Security Final Year students on Contest 516
# Sourced from live LeetCode GraphQL recent AC submissions and contest telemetry
FINAL_YEAR_DATA = [
    {"reg_no": "23CC001", "name": "AATHAVAN T", "username": "AathavanThiyakeswaran", "q1": 0, "q2": 0, "q3": 0, "q4": 0, "solved": 0, "status": "NOT ATTENDED"},
    {"reg_no": "23CC002", "name": "S.ABIRAMI", "username": "ShtLj6CNJL", "q1": 1, "q2": 1, "q3": 0, "q4": 0, "solved": 2, "status": "ATTENDED"},
    {"reg_no": "23CC003", "name": "ASWIN P", "username": "aswinkanin", "q1": 1, "q2": 1, "q3": 0, "q4": 0, "solved": 2, "status": "ATTENDED"},
    {"reg_no": "23CC005", "name": "BHARATH I", "username": "Bharath_77", "q1": 1, "q2": 1, "q3": 0, "q4": 0, "solved": 2, "status": "ATTENDED"},
    {"reg_no": "23CC007", "name": "DEEPADHARSHINI C", "username": "deepadharshini_10", "q1": 1, "q2": 1, "q3": 1, "q4": 0, "solved": 3, "status": "ATTENDED"},
    {"reg_no": "23CC009", "name": "DEEPAKKUMAR E", "username": "Deepak1524", "q1": 1, "q2": 1, "q3": 0, "q4": 0, "solved": 2, "status": "ATTENDED"},
    {"reg_no": "23CC010", "name": "DEEPAKKUMAR M", "username": "Deepak2612", "q1": 0, "q2": 0, "q3": 0, "q4": 0, "solved": 0, "status": "NOT ATTENDED"},
    {"reg_no": "23CC013", "name": "ENIYAVAN R", "username": "Eniyavan_r", "q1": 0, "q2": 0, "q3": 0, "q4": 0, "solved": 0, "status": "NOT ATTENDED"},
    {"reg_no": "23CC017", "name": "JANARANSHINI P", "username": "Janaranshini_17", "q1": 1, "q2": 1, "q3": 1, "q4": 0, "solved": 3, "status": "ATTENDED"},
    {"reg_no": "23CC020", "name": "KANISHAA.K.S", "username": "kani_shaa", "q1": 1, "q2": 1, "q3": 0, "q4": 0, "solved": 2, "status": "ATTENDED"},
    {"reg_no": "23CC021", "name": "KANISKA N J", "username": "ka_nizzu29", "q1": 1, "q2": 1, "q3": 0, "q4": 0, "solved": 2, "status": "ATTENDED"},
    {"reg_no": "23CC023", "name": "KAVINRAJAN K", "username": "kavinrajan", "q1": 1, "q2": 1, "q3": 0, "q4": 0, "solved": 2, "status": "ATTENDED"},
    {"reg_no": "23CC025", "name": "KEERTHANA B", "username": "Keerthu-2005", "q1": 1, "q2": 1, "q3": 0, "q4": 0, "solved": 2, "status": "ATTENDED"},
    {"reg_no": "23CC031", "name": "MOWNAVARTHINI A L", "username": "mowna_14", "q1": 0, "q2": 0, "q3": 0, "q4": 0, "solved": 0, "status": "NOT ATTENDED"},
    {"reg_no": "23CC038", "name": "PRAVEEN KUMAR J", "username": "PRAVEEN360", "q1": 1, "q2": 1, "q3": 0, "q4": 0, "solved": 2, "status": "ATTENDED"},
    {"reg_no": "23CC039", "name": "PRAVEEN VENKATESH A", "username": "pravexn", "q1": 0, "q2": 0, "q3": 0, "q4": 0, "solved": 0, "status": "NOT ATTENDED"},
    {"reg_no": "23CC042", "name": "PRIYADHARSHINI K", "username": "dhars_02", "q1": 0, "q2": 0, "q3": 0, "q4": 0, "solved": 0, "status": "NOT ATTENDED"},
    {"reg_no": "23CC043", "name": "RAGAVAN S", "username": "j123kcmcm", "q1": 0, "q2": 0, "q3": 0, "q4": 0, "solved": 0, "status": "NOT ATTENDED"},
    {"reg_no": "23CC044", "name": "RAM PRAKASH S", "username": "Ramprakash5", "q1": 1, "q2": 1, "q3": 0, "q4": 0, "solved": 2, "status": "ATTENDED"},
    {"reg_no": "23CC045", "name": "RATHEESH S", "username": "ratheesh1226", "q1": 1, "q2": 1, "q3": 0, "q4": 0, "solved": 2, "status": "ATTENDED"},
    {"reg_no": "23CC046", "name": "RITHIKA P", "username": "rithikap13", "q1": 1, "q2": 1, "q3": 1, "q4": 0, "solved": 3, "status": "ATTENDED"},
    {"reg_no": "23CC047", "name": "SARAVANAN R", "username": "SARAVANAN_ROLEX", "q1": 1, "q2": 1, "q3": 1, "q4": 0, "solved": 3, "status": "ATTENDED"},
    {"reg_no": "23CC050", "name": "SRIVIDHYA S", "username": "SRIVIDHYA_25", "q1": 1, "q2": 1, "q3": 0, "q4": 0, "solved": 2, "status": "ATTENDED"},
    {"reg_no": "23CC051", "name": "SRIRAM.S", "username": "Sriram6758", "q1": 0, "q2": 0, "q3": 0, "q4": 0, "solved": 0, "status": "NOT ATTENDED"},
    {"reg_no": "23CC052", "name": "STEFFY MARTINA P", "username": "Steffy_15", "q1": 1, "q2": 1, "q3": 0, "q4": 0, "solved": 2, "status": "ATTENDED"},
    {"reg_no": "23CC053", "name": "SUBITHA P S", "username": "23cc053", "q1": 1, "q2": 1, "q3": 0, "q4": 0, "solved": 2, "status": "ATTENDED"},
    {"reg_no": "23CC056", "name": "VIGNESH J", "username": "Vignesh_2639", "q1": 0, "q2": 0, "q3": 0, "q4": 0, "solved": 0, "status": "NOT ATTENDED"},
    {"reg_no": "23CC059", "name": "WASIM M", "username": "Wasim_M", "q1": 1, "q2": 1, "q3": 0, "q4": 0, "solved": 2, "status": "ATTENDED"},
]

def main():
    print("=" * 80)
    print("GENERATING CYBER SECURITY FINAL YEAR [IV YEAR] CONTEST 516 PDF REPORT")
    print(f"Alphabetical Order (A to Z) • Date: 23.08.2026")
    print("=" * 80)

    # Sort strictly in Alphabetical Order by Student Name (A to Z)
    students = sorted(FINAL_YEAR_DATA, key=lambda s: s["name"].upper())

    total_count = len(students)
    attended_count = sum(1 for s in students if s["solved"] > 0)
    q3_count = sum(1 for s in students if s["solved"] == 3)
    q2_count = sum(1 for s in students if s["solved"] == 2)
    q1_count = sum(1 for s in students if s["solved"] == 1)
    not_att_count = total_count - attended_count

    print(f"Total Final Year Students: {total_count}")
    print(f"Attended/Solved: {attended_count} ({round(attended_count/total_count*100, 1)}%)")
    print(f"3Q: {q3_count} | 2Q: {q2_count} | 1Q: {q1_count} | Not Attended: {not_att_count}")

    # Build ReportLab Landscape A4 PDF Document
    doc = SimpleDocTemplate(
        OUTPUT_PDF,
        pagesize=landscape(A4),
        leftMargin=24,
        rightMargin=24,
        topMargin=20,
        bottomMargin=20
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        'HeaderTitle',
        parent=styles['Heading1'],
        fontSize=14,
        leading=17,
        textColor=colors.HexColor('#0F172A'),
        alignment=1,
        fontName='Helvetica-Bold'
    )
    dept_style = ParagraphStyle(
        'DeptTitle',
        parent=styles['Heading2'],
        fontSize=12,
        leading=15,
        textColor=colors.HexColor('#4338CA'),
        alignment=1,
        fontName='Helvetica-Bold'
    )
    subtitle_style = ParagraphStyle(
        'HeaderSub',
        parent=styles['Normal'],
        fontSize=9.5,
        leading=13,
        textColor=colors.HexColor('#334155'),
        alignment=1,
        fontName='Helvetica'
    )
    cell_hdr = ParagraphStyle(
        'CellHdr',
        parent=styles['Normal'],
        fontSize=8.5,
        leading=11,
        textColor=colors.white,
        alignment=1,
        fontName='Helvetica-Bold'
    )
    cell_txt = ParagraphStyle(
        'CellTxt',
        parent=styles['Normal'],
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#1E293B'),
        alignment=0,
        fontName='Helvetica'
    )
    cell_center = ParagraphStyle(
        'CellCenter',
        parent=styles['Normal'],
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#1E293B'),
        alignment=1,
        fontName='Helvetica'
    )
    cell_green = ParagraphStyle(
        'CellGreen',
        parent=styles['Normal'],
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#166534'),
        alignment=1,
        fontName='Helvetica-Bold'
    )
    cell_grey = ParagraphStyle(
        'CellGrey',
        parent=styles['Normal'],
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#94A3B8'),
        alignment=1,
        fontName='Helvetica'
    )

    story = []

    # Title & College Branding Header
    story.append(Paragraph("<b>NANDHA ENGINEERING COLLEGE (AUTONOMOUS) — ERODE</b>", title_style))
    story.append(Spacer(1, 2))
    story.append(Paragraph("<b>DEPARTMENT OF COMPUTER SCIENCE AND ENGINEERING (CYBER SECURITY)</b>", dept_style))
    story.append(Spacer(1, 2))
    story.append(Paragraph("<b>OFFICIAL LEETCODE WEEKLY CONTEST 516 PERFORMANCE REPORT — FINAL YEAR (IV YEAR)</b>", subtitle_style))
    story.append(Paragraph(f"<b>Batch: 2023 – 2027 (IV Year)</b> • Contest Date: <b>23.08.2026 (Sunday)</b> • Total Students: <b>28</b> • Alphabetical Order (A to Z)", subtitle_style))
    story.append(Spacer(1, 6))
    story.append(HRFlowable(width="100%", thickness=1.8, color=colors.HexColor('#4338CA'), spaceBefore=2, spaceAfter=8))

    # Executive Summary Card Table
    summary_data = [
        [
            Paragraph("<b>Total Final Year Students</b>", cell_hdr),
            Paragraph("<b>Contest Solved / Attended</b>", cell_hdr),
            Paragraph("<b>3 Questions Solved 🥇</b>", cell_hdr),
            Paragraph("<b>2 Questions Solved 🥈</b>", cell_hdr),
            Paragraph("<b>1 Question Solved 🥉</b>", cell_hdr),
            Paragraph("<b>Not Attended 🔴</b>", cell_hdr)
        ],
        [
            Paragraph(f"<b>{total_count}</b>", cell_center),
            Paragraph(f"<b>{attended_count} ({round(attended_count/total_count*100, 1)}%)</b>", cell_green),
            Paragraph(f"<b>{q3_count}</b>", cell_center),
            Paragraph(f"<b>{q2_count}</b>", cell_center),
            Paragraph(f"<b>{q1_count}</b>", cell_center),
            Paragraph(f"<b>{not_att_count} ({round(not_att_count/total_count*100, 1)}%)</b>", cell_center)
        ]
    ]
    t_sum = Table(summary_data, colWidths=[130, 150, 125, 125, 120, 130])
    t_sum.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1E293B')),
        ('BACKGROUND', (0, 1), (-1, 1), colors.HexColor('#F8FAFC')),
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

    # Column widths for Landscape A4 (Total width = ~780)
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
        # Highlight 3Q solvers with light green
        if students[r_idx - 1]["solved"] >= 3:
            table_style.append(('BACKGROUND', (0, r_idx), (-1, r_idx), colors.HexColor('#DCFCE7')))

    t_roster.setStyle(TableStyle(table_style))
    story.append(t_roster)
    
    story.append(Spacer(1, 10))
    footer_text = f"<b>Nandha Engineering College (Autonomous)</b> — Department of CSE (Cyber Security) • Report Generated on {datetime.datetime.now(IST).strftime('%d %B %Y, %I:%M %p IST')}"
    story.append(Paragraph(footer_text, ParagraphStyle('Footer', parent=styles['Normal'], fontSize=8, textColor=colors.HexColor('#64748B'), alignment=1)))

    doc.build(story)
    print(f"\n✅ Final Year PDF Generated Successfully: {OUTPUT_PDF} ({os.path.getsize(OUTPUT_PDF):,} bytes)")

if __name__ == "__main__":
    main()
