"""
SECTION 2 & 3: Department Intelligence & Year-wise Intelligence
"""

from reportlab.platypus import Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib import colors
from reportlab.lib.units import inch

from backend.pdf_v2.styles import (
    COLOR_PRIMARY_NAVY, COLOR_SECONDARY_BLUE, COLOR_BG_LIGHT, COLOR_BORDER, COLOR_BRAND_BLUE, COLOR_SUCCESS
)
from backend.pdf_v2.charts import create_vertical_bar_chart


def build_department_intelligence(dataset: dict, styles: dict, table_style: TableStyle) -> list:
    story = []
    depts = dataset.get("department_list", [])
    meta = dataset.get("metadata", {})
    w0_label = meta.get("period_w0", "Current")
    w1_label = meta.get("period_w1", "W-1")
    w2_label = meta.get("period_w2", "W-2")

    story.append(Paragraph("<b>2. DEPARTMENT INTELLIGENCE (3-WEEK COMPARISON & ATTENDANCE)</b>", styles['SectionTitle']))
    
    data = [
        [
            Paragraph("<b>#</b>", styles['TH']),
            Paragraph("<b>Department Name</b>", styles['THLeft']),
            Paragraph("<b>Faculty Coordinator</b>", styles['THLeft']),
            Paragraph("<b>Students</b>", styles['TH']),
            Paragraph(f"<b>{w2_label}</b>", styles['TH']),
            Paragraph(f"<b>{w1_label}</b>", styles['TH']),
            Paragraph(f"<b>{w0_label}</b>", styles['TH']),
            Paragraph("<b>Delta</b>", styles['TH']),
            Paragraph("<b>Growth %</b>", styles['TH']),
            Paragraph("<b>Avg Solved</b>", styles['TH']),
            Paragraph("<b>Contest Attended</b>", styles['TH'])
        ]
    ]

    tot_students = sum(d.get("total_students", 0) for d in depts)
    tot_w2 = sum(d.get("prev_prev_solved", 0) for d in depts)
    tot_w1 = sum(d.get("prev_solved", 0) for d in depts)
    tot_w0 = sum(d.get("current_solved", 0) for d in depts)
    tot_delta = max(0, tot_w0 - tot_w1)
    tot_growth = round((tot_delta / max(1, tot_w1)) * 100, 1) if tot_w1 > 0 else 0.0
    tot_contest = sum(d.get("contest_participants", 0) for d in depts)

    for idx, d in enumerate(depts, 1):
        delta = d.get("weekly_new", 0)
        delta_str = f"+{delta:,}" if delta > 0 else str(delta)
        delta_style = styles['TDSuccess'] if delta > 0 else styles['TD']
        growth = d.get("growth_pct", 0.0)
        
        data.append([
            Paragraph(str(idx), styles['TD']),
            Paragraph(f"<b>{d.get('department')}</b>", styles['TDLeft']),
            Paragraph(d.get("coordinator", "Department Coordinator"), styles['TDLeft']),
            Paragraph(str(d.get("total_students", 0)), styles['TD']),
            Paragraph(f"{d.get('prev_prev_solved', 0):,}", styles['TD']),
            Paragraph(f"{d.get('prev_solved', 0):,}", styles['TD']),
            Paragraph(f"<b>{d.get('current_solved', 0):,}</b>", styles['TDBold']),
            Paragraph(delta_str, delta_style),
            Paragraph(f"{growth}%", styles['TD']),
            Paragraph(f"{d.get('avg_solved', 0.0):.1f}", styles['TD']),
            Paragraph(f"{d.get('contest_participants', 0)} ({d.get('contest_participation_pct', 0.0)}%)", styles['TD']),
        ])

    # Total row
    data.append([
        Paragraph("<b>TOTAL</b>", styles['TDBold']),
        Paragraph("<b>COLLEGE AGGREGATE</b>", styles['TDBoldLeft']),
        Paragraph("<b>All Coordinators</b>", styles['TDBoldLeft']),
        Paragraph(f"<b>{tot_students}</b>", styles['TDBold']),
        Paragraph(f"<b>{tot_w2:,}</b>", styles['TDBold']),
        Paragraph(f"<b>{tot_w1:,}</b>", styles['TDBold']),
        Paragraph(f"<b>{tot_w0:,}</b>", styles['TDBold']),
        Paragraph(f"<b>+{tot_delta:,}</b>", styles['TDSuccess']),
        Paragraph(f"<b>{tot_growth}%</b>", styles['TDBold']),
        Paragraph(f"<b>{round(tot_w0 / max(1, tot_students), 1)}</b>", styles['TDBold']),
        Paragraph(f"<b>{tot_contest}</b>", styles['TDBold']),
    ])

    col_widths = [0.35*inch, 1.35*inch, 1.8*inch, 0.7*inch, 0.85*inch, 0.85*inch, 0.95*inch, 0.75*inch, 0.85*inch, 0.85*inch, 1.5*inch]
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), COLOR_PRIMARY_NAVY),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor("#E2E8F0")),
        ('GRID', (0, 0), (-1, -1), 0.5, COLOR_BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('ROWBACKGROUNDS', (0, 1), (-1, -2), [colors.white, COLOR_BG_LIGHT])
    ]))
    story.append(t)
    story.append(Spacer(1, 8))

    # Department Comparative Bar Chart
    if depts:
        categories = [d.get("department", "") for d in depts]
        w1_vals = [d.get("prev_solved", 0) for d in depts]
        w0_vals = [d.get("current_solved", 0) for d in depts]
        chart = create_vertical_bar_chart(
            data=[w0_vals, w1_vals],
            categories=categories,
            width=10.7*inch,
            height=85,
            title="Department-wise Solved Volume Comparison (Current Week vs Previous Week)",
            series_colors=[COLOR_BRAND_BLUE, colors.HexColor("#94A3B8")]
        )
        story.append(chart)

    story.append(Spacer(1, 10))
    return story


def build_year_intelligence(dataset: dict, styles: dict, table_style: TableStyle) -> list:
    story = []
    years = dataset.get("year_list", [])
    meta = dataset.get("metadata", {})
    w0_label = meta.get("period_w0", "Current")
    w1_label = meta.get("period_w1", "W-1")
    w2_label = meta.get("period_w2", "W-2")

    story.append(Paragraph("<b>3. YEAR-WISE / BATCH INTELLIGENCE</b>", styles['SectionTitle']))
    
    data = [
        [
            Paragraph("<b>Academic Year</b>", styles['THLeft']),
            Paragraph("<b>Batch Cohort</b>", styles['THLeft']),
            Paragraph("<b>Total Students</b>", styles['TH']),
            Paragraph("<b>Active Solvers</b>", styles['TH']),
            Paragraph(f"<b>{w2_label}</b>", styles['TH']),
            Paragraph(f"<b>{w1_label}</b>", styles['TH']),
            Paragraph(f"<b>{w0_label}</b>", styles['TH']),
            Paragraph("<b>Weekly Delta</b>", styles['TH']),
            Paragraph("<b>Growth %</b>", styles['TH']),
            Paragraph("<b>Avg Solved / Std</b>", styles['TH']),
            Paragraph("<b>Contest Attendance</b>", styles['TH'])
        ]
    ]

    for y in years:
        delta = y.get("weekly_new", 0)
        delta_str = f"+{delta:,}" if delta > 0 else str(delta)
        delta_style = styles['TDSuccess'] if delta > 0 else styles['TD']
        growth = y.get("growth_pct", 0.0)

        data.append([
            Paragraph(f"<b>Year {y.get('year')}</b>", styles['TDLeft']),
            Paragraph(y.get("batch_label", ""), styles['TDLeft']),
            Paragraph(str(y.get("total_students", 0)), styles['TD']),
            Paragraph(f"<font color='#059669'><b>{y.get('active_students', 0)}</b></font>", styles['TDBold']),
            Paragraph(f"{y.get('prev_prev_solved', 0):,}", styles['TD']),
            Paragraph(f"{y.get('prev_solved', 0):,}", styles['TD']),
            Paragraph(f"<b>{y.get('current_solved', 0):,}</b>", styles['TDBold']),
            Paragraph(delta_str, delta_style),
            Paragraph(f"{growth}%", styles['TD']),
            Paragraph(f"{y.get('avg_solved', 0.0):.1f}", styles['TD']),
            Paragraph(f"{y.get('contest_participants', 0)} ({y.get('contest_participation_pct', 0.0)}%)", styles['TD']),
        ])

    col_widths = [1.2*inch, 1.4*inch, 0.9*inch, 0.9*inch, 0.95*inch, 0.95*inch, 1.05*inch, 0.85*inch, 0.75*inch, 0.85*inch, 0.9*inch]
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), COLOR_SECONDARY_BLUE),
        ('GRID', (0, 0), (-1, -1), 0.5, COLOR_BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, COLOR_BG_LIGHT])
    ]))
    story.append(t)
    story.append(Spacer(1, 8))

    # Year-wise Bar Chart
    if years:
        categories = [f"Year {y.get('year', '')}" for y in years]
        solved_vals = [y.get("current_solved", 0) for y in years]
        chart = create_vertical_bar_chart(
            data=[solved_vals],
            categories=categories,
            width=10.7*inch,
            height=85,
            title="Year-wise Problem Solving Distribution (Current Week Total)",
            series_colors=[colors.HexColor("#059669")]
        )
        story.append(chart)

    return story
