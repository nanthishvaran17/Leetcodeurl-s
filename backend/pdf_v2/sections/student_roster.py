"""
SECTION 7: Student-Level 3-Week Rolling Comparison Roster
"""

from reportlab.platypus import Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors
from reportlab.lib.units import inch

from backend.pdf_v2.styles import (
    COLOR_PRIMARY_NAVY, COLOR_BG_LIGHT, COLOR_BORDER, COLOR_SUCCESS, COLOR_DANGER
)


def build_student_roster(dataset: dict, styles: dict, table_style: TableStyle, max_students: int = 150) -> list:
    story = []
    students = dataset.get("students", [])
    meta = dataset.get("metadata", {})
    w0_label = meta.get("period_w0", "Current")
    w1_label = meta.get("period_w1", "W-1")
    w2_label = meta.get("period_w2", "W-2")

    story.append(Paragraph("<b>7. STUDENT-LEVEL 3-WEEK ROLLING COMPARISON ROSTER</b>", styles['SectionTitle']))
    
    # Sort students by current solved descending
    sorted_students = sorted(students, key=lambda x: x.get("current_solved", 0), reverse=True)
    
    data = [
        [
            Paragraph("<b>Rank</b>", styles['TH']),
            Paragraph("<b>Register No</b>", styles['TH']),
            Paragraph("<b>Student Name</b>", styles['THLeft']),
            Paragraph("<b>Dept</b>", styles['TH']),
            Paragraph("<b>Year</b>", styles['TH']),
            Paragraph("<b>LeetCode ID</b>", styles['THLeft']),
            Paragraph(f"<b>{w2_label}</b>", styles['TH']),
            Paragraph(f"<b>{w1_label}</b>", styles['TH']),
            Paragraph(f"<b>{w0_label}</b>", styles['TH']),
            Paragraph("<b>Delta</b>", styles['TH']),
            Paragraph("<b>Growth %</b>", styles['TH']),
            Paragraph("<b>Rating</b>", styles['TH']),
            Paragraph("<b>Risk Status</b>", styles['TH'])
        ]
    ]

    for rank, s in enumerate(sorted_students[:max_students], 1):
        delta = s.get("weekly_delta", 0)
        delta_str = f"+{delta}" if delta > 0 else str(delta)
        delta_style = styles['TDSuccess'] if delta > 0 else styles['TD']
        
        rating_val = s.get("contest_rating")
        rating_str = f"{rating_val:.1f}" if rating_val and rating_val > 0 else "—"
        
        risk_str = s.get("risk_level", "MODERATE")
        risk_color = "#059669" if risk_str == "LOW" else ("#D97706" if risk_str == "MODERATE" else "#DC2626")

        # Trim or wrap student name cleanly
        name_str = s.get("name", "")
        if len(name_str) > 22:
            name_str = name_str[:20] + "..."

        uname_str = s.get("username", "N/A")
        if uname_str and len(uname_str) > 16:
            uname_str = uname_str[:14] + "..."

        data.append([
            Paragraph(str(rank), styles['TD']),
            Paragraph(s.get("reg_no", ""), styles['TD']),
            Paragraph(f"<b>{name_str}</b>", styles['TDLeft']),
            Paragraph(s.get("department", ""), styles['TD']),
            Paragraph(s.get("year", ""), styles['TD']),
            Paragraph(uname_str or "N/A", styles['TDLeft']),
            Paragraph(f"{s.get('prev_prev_solved', 0):,}", styles['TD']),
            Paragraph(f"{s.get('prev_solved', 0):,}", styles['TD']),
            Paragraph(f"<b>{s.get('current_solved', 0):,}</b>", styles['TDBold']),
            Paragraph(delta_str, delta_style),
            Paragraph(f"{s.get('growth_pct', 0.0)}%", styles['TD']),
            Paragraph(rating_str, styles['TD']),
            Paragraph(f"<font color='{risk_color}'><b>{risk_str}</b></font>", styles['TD']),
        ])

    col_widths = [
        0.45*inch, 1.05*inch, 1.85*inch, 0.75*inch, 0.55*inch, 1.25*inch,
        0.75*inch, 0.75*inch, 0.85*inch, 0.65*inch, 0.65*inch, 0.65*inch, 0.95*inch
    ]
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), COLOR_PRIMARY_NAVY),
        ('GRID', (0, 0), (-1, -1), 0.5, COLOR_BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 2.2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2.2),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, COLOR_BG_LIGHT])
    ]))
    story.append(t)
    story.append(Spacer(1, 10))

    return story
