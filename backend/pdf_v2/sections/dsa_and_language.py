"""
SECTION 4 & 5: DSA Topic Intelligence & Programming Language Intelligence
"""

from reportlab.platypus import Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors
from reportlab.lib.units import inch

from backend.pdf_v2.styles import (
    COLOR_PRIMARY_NAVY, COLOR_SECONDARY_BLUE, COLOR_BG_LIGHT, COLOR_BORDER, COLOR_BRAND_BLUE
)
from backend.pdf_v2.charts import create_vertical_bar_chart


def build_dsa_intelligence(dataset: dict, styles: dict, table_style: TableStyle) -> list:
    story = []
    dsa_data = dataset.get("dsa_topic_intelligence", {})
    top_topics = dsa_data.get("top_topics", [])
    year_matrix = dsa_data.get("year_matrix", {})

    story.append(Paragraph("<b>4. DSA TOPIC INTELLIGENCE - YEAR-WISE & INSTITUTIONAL BREAKDOWN</b>", styles['SectionTitle']))
    
    data = [
        [
            Paragraph("<b>#</b>", styles['TH']),
            Paragraph("<b>DSA Topic Name</b>", styles['THLeft']),
            Paragraph("<b>Curriculum Tier</b>", styles['TH']),
            Paragraph("<b>Year I</b>", styles['TH']),
            Paragraph("<b>Year II</b>", styles['TH']),
            Paragraph("<b>Year III</b>", styles['TH']),
            Paragraph("<b>Year IV</b>", styles['TH']),
            Paragraph("<b>Total Solved</b>", styles['TH']),
            Paragraph("<b>Active Students</b>", styles['TH']),
            Paragraph("<b>% of Total Solves</b>", styles['TH'])
        ]
    ]

    tot_topic_solved = sum(t.get("problems_solved", 0) for t in top_topics) or 1

    for idx, t in enumerate(top_topics[:14], 1):
        t_name = t.get("topic_name", "General")
        y1_cnt = year_matrix.get("I", {}).get(t_name, 0)
        y2_cnt = year_matrix.get("II", {}).get(t_name, 0)
        y3_cnt = year_matrix.get("III", {}).get(t_name, 0)
        y4_cnt = year_matrix.get("IV", {}).get(t_name, 0)
        t_solved = t.get("problems_solved", 0)
        t_students = t.get("student_count", 0)
        t_pct = round((t_solved / tot_topic_solved) * 100, 1)

        tier_str = t.get("tier", "Fundamental")
        tier_color = "#10B981" if tier_str == "Fundamental" else ("#F59E0B" if tier_str == "Intermediate" else "#EF4444")

        data.append([
            Paragraph(str(idx), styles['TD']),
            Paragraph(f"<b>{t_name}</b>", styles['TDLeft']),
            Paragraph(f"<font color='{tier_color}'><b>{tier_str}</b></font>", styles['TD']),
            Paragraph(str(y1_cnt), styles['TD']),
            Paragraph(str(y2_cnt), styles['TD']),
            Paragraph(str(y3_cnt), styles['TD']),
            Paragraph(str(y4_cnt), styles['TD']),
            Paragraph(f"<b>{t_solved:,}</b>", styles['TDBold']),
            Paragraph(str(t_students), styles['TD']),
            Paragraph(f"<b>{t_pct}%</b>", styles['TD']),
        ])

    col_widths = [0.4*inch, 2.2*inch, 1.2*inch, 0.8*inch, 0.8*inch, 0.8*inch, 0.8*inch, 1.1*inch, 1.1*inch, 1.5*inch]
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), COLOR_PRIMARY_NAVY),
        ('GRID', (0, 0), (-1, -1), 0.5, COLOR_BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 2.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, COLOR_BG_LIGHT])
    ]))
    story.append(t)
    story.append(Spacer(1, 8))

    # Top Topics Chart
    if top_topics:
        chart_topics = top_topics[:8]
        categories = [t.get("topic_name", "")[:10] for t in chart_topics]
        vals = [t.get("problems_solved", 0) for t in chart_topics]
        chart = create_vertical_bar_chart(
            data=[vals],
            categories=categories,
            width=10.7*inch,
            height=80,
            title="Top DSA Topics Solved Volume Across College",
            series_colors=[colors.HexColor("#6366F1")]
        )
        story.append(chart)

    story.append(Spacer(1, 10))
    return story


def build_language_intelligence(dataset: dict, styles: dict, table_style: TableStyle) -> list:
    story = []
    lang_data = dataset.get("language_intelligence", {})
    top_langs = lang_data.get("top_languages", [])
    year_matrix = lang_data.get("year_matrix", {})

    story.append(Paragraph("<b>5. PROGRAMMING LANGUAGE INTELLIGENCE - YEAR-WISE BREAKDOWN</b>", styles['SectionTitle']))
    
    data = [
        [
            Paragraph("<b>#</b>", styles['TH']),
            Paragraph("<b>Programming Language</b>", styles['THLeft']),
            Paragraph("<b>Year I Solved</b>", styles['TH']),
            Paragraph("<b>Year II Solved</b>", styles['TH']),
            Paragraph("<b>Year III Solved</b>", styles['TH']),
            Paragraph("<b>Year IV Solved</b>", styles['TH']),
            Paragraph("<b>Total Solved</b>", styles['TH']),
            Paragraph("<b>Active Coders</b>", styles['TH']),
            Paragraph("<b>Institutional Share %</b>", styles['TH'])
        ]
    ]

    tot_lang_solved = sum(l.get("problems_solved", 0) for l in top_langs) or 1

    for idx, l in enumerate(top_langs[:8], 1):
        l_name = l.get("language_name", "General")
        y1_cnt = year_matrix.get("I", {}).get(l_name, 0)
        y2_cnt = year_matrix.get("II", {}).get(l_name, 0)
        y3_cnt = year_matrix.get("III", {}).get(l_name, 0)
        y4_cnt = year_matrix.get("IV", {}).get(l_name, 0)
        l_solved = l.get("problems_solved", 0)
        l_students = l.get("student_count", 0)
        l_pct = round((l_solved / tot_lang_solved) * 100, 1)

        data.append([
            Paragraph(str(idx), styles['TD']),
            Paragraph(f"<b>{l_name}</b>", styles['TDLeft']),
            Paragraph(str(y1_cnt), styles['TD']),
            Paragraph(str(y2_cnt), styles['TD']),
            Paragraph(str(y3_cnt), styles['TD']),
            Paragraph(str(y4_cnt), styles['TD']),
            Paragraph(f"<b>{l_solved:,}</b>", styles['TDBold']),
            Paragraph(str(l_students), styles['TD']),
            Paragraph(f"<b>{l_pct}%</b>", styles['TD']),
        ])

    col_widths = [0.4*inch, 2.3*inch, 1.0*inch, 1.0*inch, 1.0*inch, 1.0*inch, 1.2*inch, 1.2*inch, 1.6*inch]
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), COLOR_SECONDARY_BLUE),
        ('GRID', (0, 0), (-1, -1), 0.5, COLOR_BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 2.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, COLOR_BG_LIGHT])
    ]))
    story.append(t)
    story.append(Spacer(1, 8))

    # Top Languages Chart
    if top_langs:
        chart_langs = top_langs[:6]
        categories = [l.get("language_name", "") for l in chart_langs]
        vals = [l.get("problems_solved", 0) for l in chart_langs]
        chart = create_vertical_bar_chart(
            data=[vals],
            categories=categories,
            width=10.7*inch,
            height=80,
            title="Programming Language Dominance Across Institution",
            series_colors=[colors.HexColor("#D97706")]
        )
        story.append(chart)

    return story
