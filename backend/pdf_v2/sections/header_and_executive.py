"""
SECTION 1: Header Banner & Executive Dashboard
"""

import os
from reportlab.platypus import Paragraph, Spacer, Table, TableStyle, Image, HRFlowable
from reportlab.lib import colors
from reportlab.lib.units import inch

from backend.pdf_v2.styles import (
    COLOR_PRIMARY_NAVY, COLOR_SECONDARY_BLUE, COLOR_BRAND_BLUE,
    COLOR_BG_LIGHT, COLOR_BORDER, COLOR_SUCCESS, COLOR_DANGER
)
from backend.pdf_v2.charts import create_vertical_bar_chart, create_horizontal_distribution_bar


def build_header_and_executive(dataset: dict, styles: dict, table_style: TableStyle) -> list:
    story = []
    meta = dataset.get("metadata", {})
    summary = dataset.get("summary", {})
    
    # 1. Institutional Emblem & Header Banner
    logo_path = os.path.join(os.path.dirname(__file__), "..", "..", "assets", "nandha_emblem.png")
    
    header_lines = [
        Paragraph("<b>NANDHA ENGINEERING COLLEGE (AUTONOMOUS)</b>", styles['DocTitle']),
        Spacer(1, 1.5),
        Paragraph("(Approved by AICTE, New Delhi & Affiliated to Anna University, Chennai • Accredited by NAAC)", styles['MetaText']),
        Spacer(1, 1.5),
        Paragraph("<b>FRIDAY WEEKLY LEETCODE INTELLIGENCE REPORT</b>", styles['DocSubTitle']),
        Spacer(1, 2),
        Paragraph(
            f"<b>Reporting Window:</b> {meta.get('window_str')}   |   "
            f"<b>Report Date:</b> {meta.get('report_date')}   |   "
            f"<b>Snapshot ID:</b> {meta.get('snapshot_id')}   |   "
            f"<b>Generated:</b> {meta.get('generated_at')}",
            styles['MetaText']
        )
    ]
    
    if os.path.exists(logo_path):
        try:
            img = Image(logo_path, width=0.9*inch, height=0.75*inch)
            t_hdr = Table([[img, header_lines]], colWidths=[1.0*inch, 9.7*inch])
            t_hdr.setStyle(TableStyle([
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('ALIGN', (0, 0), (0, 0), 'LEFT'),
                ('ALIGN', (1, 0), (1, 0), 'CENTER'),
                ('LEFTPADDING', (0, 0), (-1, -1), 0),
                ('RIGHTPADDING', (0, 0), (-1, -1), 0),
                ('TOPPADDING', (0, 0), (-1, -1), 0),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
            ]))
            story.append(t_hdr)
        except Exception:
            story.extend(header_lines)
    else:
        story.extend(header_lines)
        
    story.append(Spacer(1, 6))
    story.append(HRFlowable(width="100%", thickness=1.5, color=COLOR_PRIMARY_NAVY, spaceAfter=8))
    
    # 2. Executive Dashboard KPI Summary Cards
    tot_students = summary.get("total_students", 0)
    active_solvers = summary.get("active_students", 0)
    tot_solved = summary.get("total_solved", 0)
    weekly_new = summary.get("weekly_new_solved", 0)
    growth_pct = summary.get("growth_pct", 0.0)
    avg_solved = round(tot_solved / max(1, tot_students), 1)
    avg_rating = summary.get("average_rating")
    rating_str = f"{avg_rating:.1f}" if avg_rating else "N/A"
    contest_participants = summary.get("contest_participants", 0)
    contest_att_pct = (contest_participants / max(1, tot_students)) * 100

    kpi_cards = [
        [
            Paragraph("<b>TOTAL ACTIVE STUDENTS</b>", styles['TH']),
            Paragraph("<b>TOTAL PROBLEMS SOLVED</b>", styles['TH']),
            Paragraph("<b>ACTIVE SOLVERS (>0)</b>", styles['TH']),
            Paragraph("<b>AVG PROBLEMS / STUDENT</b>", styles['TH']),
            Paragraph("<b>COLLEGE AVG RATING</b>", styles['TH']),
            Paragraph("<b>CONTEST ATTENDANCE</b>", styles['TH'])
        ],
        [
            Paragraph(f"<font size=11 color='#0F172A'><b>{tot_students}</b></font><br/><font size=6.5 color='#64748B'>Verified Students</font>", styles['TDBold']),
            Paragraph(f"<font size=11 color='#1D4ED8'><b>{tot_solved:,}</b></font><br/><font size=6.5 color='#059669'>+{weekly_new:,} new ({growth_pct}%)</font>", styles['TDBold']),
            Paragraph(f"<font size=11 color='#059669'><b>{active_solvers}</b></font><br/><font size=6.5 color='#64748B'>{(active_solvers/max(1, tot_students)*100):.1f}% Active Rate</font>", styles['TDBold']),
            Paragraph(f"<font size=11 color='#0F172A'><b>{avg_solved}</b></font><br/><font size=6.5 color='#64748B'>Mean Platform Solves</font>", styles['TDBold']),
            Paragraph(f"<font size=11 color='#D97706'><b>{rating_str}</b></font><br/><font size=6.5 color='#64748B'>Active Contestants</font>", styles['TDBold']),
            Paragraph(f"<font size=11 color='#059669'><b>{contest_participants}</b></font><br/><font size=6.5 color='#64748B'>{contest_att_pct:.1f}% Attendance</font>", styles['TDBold'])
        ]
    ]
    
    t_kpi = Table(kpi_cards, colWidths=[1.78*inch]*6)
    t_kpi.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), COLOR_PRIMARY_NAVY),
        ('BACKGROUND', (0, 1), (-1, 1), COLOR_BG_LIGHT),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, COLOR_BORDER),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(t_kpi)
    story.append(Spacer(1, 8))
    
    # 3. Category & Risk Distribution Blocks
    cat_dist = summary.get("category_distribution", {})
    risk_dist = summary.get("risk_distribution", {})
    
    cat_items = [
        {"label": ">500", "value": cat_dist.get("Above 500", 0), "color": colors.HexColor("#10B981")},
        {"label": "250-500", "value": cat_dist.get("250 - 500", 0), "color": colors.HexColor("#3B82F6")},
        {"label": "100-249", "value": cat_dist.get("100 - 249", 0), "color": colors.HexColor("#6366F1")},
        {"label": "1-99", "value": cat_dist.get("1 - 99", 0), "color": colors.HexColor("#F59E0B")},
        {"label": "0 Solved", "value": cat_dist.get("Not Yet Started", 0), "color": colors.HexColor("#EF4444")}
    ]
    
    cat_bar = create_horizontal_distribution_bar(cat_items, width=5.2*inch, height=18)
    
    overview_text = (
        f"<b>Executive Summary:</b> As of reporting period <b>{meta.get('window_str')}</b>, the college database tracks "
        f"<b>{tot_students} active students</b> across all production departments. Total problem-solving volume stands at "
        f"<b>{tot_solved:,} problems</b> with <b>{active_solvers} students actively coding</b>. "
        f"A total of <b>{cat_dist.get('Above 500', 0)} students</b> have solved >500 problems (Elite Tier), while "
        f"<b>{cat_dist.get('250 - 500', 0)} students</b> are in the 250–500 bracket. "
        f"Data reflects verified, live LeetCode platform statistics synchronized under immutable snapshot <code>{meta.get('snapshot_id')}</code>."
    )
    
    dist_table_data = [
        [
            Paragraph("<b>PROBLEM-SOLVING COHORT DISTRIBUTION</b>", styles['THLeft']),
            Paragraph("<b>INSTITUTIONAL PERFORMANCE OBSERVATIONS</b>", styles['THLeft'])
        ],
        [
            Table([
                [Paragraph("<b>Elite (>500):</b>", styles['NormalText']), Paragraph(f"<b>{cat_dist.get('Above 500', 0)}</b>", styles['TDBold'])],
                [Paragraph("<b>Advanced (250–500):</b>", styles['NormalText']), Paragraph(f"<b>{cat_dist.get('250 - 500', 0)}</b>", styles['TDBold'])],
                [Paragraph("<b>Intermediate (100–249):</b>", styles['NormalText']), Paragraph(f"<b>{cat_dist.get('100 - 249', 0)}</b>", styles['TDBold'])],
                [Paragraph("<b>Beginner (1–99):</b>", styles['NormalText']), Paragraph(f"<b>{cat_dist.get('1 - 99', 0)}</b>", styles['TDBold'])],
                [Paragraph("<b>Not Yet Started (0):</b>", styles['NormalText']), Paragraph(f"<font color='#DC2626'><b>{cat_dist.get('Not Yet Started', 0)}</b></font>", styles['TDBold'])],
                [cat_bar, ""]
            ], colWidths=[2.6*inch, 2.5*inch]),
            Paragraph(overview_text, styles['NormalText'])
        ]
    ]
    
    t_dist = Table(dist_table_data, colWidths=[5.35*inch, 5.35*inch])
    t_dist.setStyle(TableStyle([
        ('SPAN', (0, 0), (0, 0)),
        ('SPAN', (1, 0), (1, 0)),
        ('BACKGROUND', (0, 0), (-1, 0), COLOR_SECONDARY_BLUE),
        ('BACKGROUND', (0, 1), (-1, 1), COLOR_BG_LIGHT),
        ('GRID', (0, 0), (-1, -1), 0.5, COLOR_BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(t_dist)
    story.append(Spacer(1, 8))
    
    # 4. Institutional 3-Week Trend Vector Chart
    trend_data = dataset.get("institutional_trend", [])
    if trend_data:
        categories = [t.get("week_label", "") for t in trend_data]
        solved_vals = [t.get("solved", 0) for t in trend_data]
        chart = create_vertical_bar_chart(
            data=[solved_vals],
            categories=categories,
            width=10.7*inch,
            height=85,
            title="3-Week Institutional Problem Solving Trend (College Aggregate Cumulative)",
            series_colors=[COLOR_BRAND_BLUE]
        )
        story.append(chart)
        
    return story
