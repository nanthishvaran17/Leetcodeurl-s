"""
SECTION 10: Top Performers, Growth & Attention Cohorts
"""

from reportlab.platypus import Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors
from reportlab.lib.units import inch

from backend.pdf_v2.styles import (
    COLOR_PRIMARY_NAVY, COLOR_SECONDARY_BLUE, COLOR_BG_LIGHT, COLOR_BORDER, COLOR_SUCCESS, COLOR_DANGER
)


def build_top_performers_and_cohorts(dataset: dict, styles: dict, table_style: TableStyle) -> list:
    story = []
    cohorts = dataset.get("top_performers_cohorts", {})
    top_solvers = cohorts.get("top_solvers", [])
    top_ratings = cohorts.get("top_ratings", [])
    improvers = cohorts.get("biggest_improvers", [])
    attention = cohorts.get("attention_cohort", [])

    story.append(Paragraph("<b>10. TOP PERFORMERS, GROWTH ACCELERATION & ATTENTION COHORTS</b>", styles['SectionTitle']))
    
    # Grid 1: Top Solvers & Top Ratings side-by-side
    t_solvers_data = [
        [Paragraph("<b>TOP 5 PLATFORM SOLVERS</b>", styles['THLeft']), "", "", "", ""]
    ]
    t_solvers_data.append([
        Paragraph("<b>#</b>", styles['TH']),
        Paragraph("<b>Student Name</b>", styles['THLeft']),
        Paragraph("<b>Dept</b>", styles['TH']),
        Paragraph("<b>Yr</b>", styles['TH']),
        Paragraph("<b>Solved</b>", styles['TH'])
    ])
    for idx, s in enumerate(top_solvers[:5], 1):
        t_solvers_data.append([
            Paragraph(str(idx), styles['TD']),
            Paragraph(f"<b>{s.get('name', '')[:16]}</b>", styles['TDLeft']),
            Paragraph(s.get("department", ""), styles['TD']),
            Paragraph(s.get("year", ""), styles['TD']),
            Paragraph(f"<font color='#1D4ED8'><b>{s.get('current_solved', 0):,}</b></font>", styles['TDBold']),
        ])

    t_ratings_data = [
        [Paragraph("<b>TOP 5 CONTEST RATINGS</b>", styles['THLeft']), "", "", "", ""]
    ]
    t_ratings_data.append([
        Paragraph("<b>#</b>", styles['TH']),
        Paragraph("<b>Student Name</b>", styles['THLeft']),
        Paragraph("<b>Dept</b>", styles['TH']),
        Paragraph("<b>Yr</b>", styles['TH']),
        Paragraph("<b>Rating</b>", styles['TH'])
    ])
    for idx, s in enumerate(top_ratings[:5], 1):
        r_val = s.get("contest_rating", 0)
        t_ratings_data.append([
            Paragraph(str(idx), styles['TD']),
            Paragraph(f"<b>{s.get('name', '')[:16]}</b>", styles['TDLeft']),
            Paragraph(s.get("department", ""), styles['TD']),
            Paragraph(s.get("year", ""), styles['TD']),
            Paragraph(f"<font color='#D97706'><b>{r_val:.1f}</b></font>", styles['TDBold']),
        ])

    t1 = Table(t_solvers_data, colWidths=[0.3*inch, 2.3*inch, 0.9*inch, 0.5*inch, 1.2*inch])
    t1.setStyle(TableStyle([
        ('SPAN', (0, 0), (4, 0)),
        ('BACKGROUND', (0, 0), (-1, 0), COLOR_PRIMARY_NAVY),
        ('BACKGROUND', (0, 1), (-1, 1), COLOR_SECONDARY_BLUE),
        ('GRID', (0, 0), (-1, -1), 0.5, COLOR_BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 2.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5),
        ('ROWBACKGROUNDS', (0, 2), (-1, -1), [colors.white, COLOR_BG_LIGHT])
    ]))

    t2 = Table(t_ratings_data, colWidths=[0.3*inch, 2.3*inch, 0.9*inch, 0.5*inch, 1.2*inch])
    t2.setStyle(TableStyle([
        ('SPAN', (0, 0), (4, 0)),
        ('BACKGROUND', (0, 0), (-1, 0), COLOR_PRIMARY_NAVY),
        ('BACKGROUND', (0, 1), (-1, 1), COLOR_SECONDARY_BLUE),
        ('GRID', (0, 0), (-1, -1), 0.5, COLOR_BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 2.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5),
        ('ROWBACKGROUNDS', (0, 2), (-1, -1), [colors.white, COLOR_BG_LIGHT])
    ]))

    t_grid = Table([[t1, t2]], colWidths=[5.35*inch, 5.35*inch])
    t_grid.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
    ]))
    story.append(t_grid)
    story.append(Spacer(1, 10))

    # Grid 2: Faculty Intervention / Attention Cohort
    if attention:
        story.append(Paragraph("<b>Faculty Mentoring & Attention Required Cohort:</b>", styles['NormalText']))
        story.append(Spacer(1, 3))
        
        att_table_data = [
            [
                Paragraph("<b>#</b>", styles['TH']),
                Paragraph("<b>Register No</b>", styles['TH']),
                Paragraph("<b>Student Name</b>", styles['THLeft']),
                Paragraph("<b>Department</b>", styles['TH']),
                Paragraph("<b>Year</b>", styles['TH']),
                Paragraph("<b>Solved</b>", styles['TH']),
                Paragraph("<b>Risk Score</b>", styles['TH']),
                Paragraph("<b>Mentoring Recommendation</b>", styles['THLeft'])
            ]
        ]
        for a_idx, a in enumerate(attention[:6], 1):
            att_table_data.append([
                Paragraph(str(a_idx), styles['TD']),
                Paragraph(a.get("reg_no", ""), styles['TD']),
                Paragraph(f"<b>{a.get('name', '')}</b>", styles['TDLeft']),
                Paragraph(a.get("department", ""), styles['TD']),
                Paragraph(a.get("year", ""), styles['TD']),
                Paragraph(str(a.get("current_solved", 0)), styles['TD']),
                Paragraph(f"<font color='#DC2626'><b>{a.get('risk_score', 0):.1f}</b></font>", styles['TDBold']),
                Paragraph("Schedule 1-on-1 lab mentoring session; review active days & basic DSA modules.", styles['TDLeft'])
            ])
            
        t_att = Table(att_table_data, colWidths=[0.35*inch, 1.25*inch, 2.3*inch, 1.0*inch, 0.6*inch, 0.8*inch, 0.9*inch, 3.5*inch], repeatRows=1)
        t_att.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#7F1D1D")),
            ('GRID', (0, 0), (-1, -1), 0.5, COLOR_BORDER),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 2.5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, COLOR_BG_LIGHT])
        ]))
        story.append(t_att)

    story.append(Spacer(1, 10))
    return story
