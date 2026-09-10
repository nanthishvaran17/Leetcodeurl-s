"""
SECTION 9: Contest + Problem + Submission Intelligence
"""

from reportlab.platypus import Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors
from reportlab.lib.units import inch

from backend.pdf_v2.styles import (
    COLOR_PRIMARY_NAVY, COLOR_SECONDARY_BLUE, COLOR_BG_LIGHT, COLOR_BORDER, COLOR_BRAND_BLUE, COLOR_SUCCESS
)


def build_contest_and_problems(dataset: dict, styles: dict, table_style: TableStyle) -> list:
    story = []
    contest = dataset.get("contest_intelligence", {})
    p_breakdown = contest.get("problem_breakdown", [])
    top_rankers = contest.get("top_rankers", [])

    c_name = contest.get("contest_name", "Sunday Weekly Contest")
    c_date = contest.get("session_date", "")
    participants = contest.get("participants_count", 0)
    att_pct = contest.get("attendance_pct", 0.0)
    avg_rating = contest.get("average_rating")
    rating_str = f"{avg_rating:.1f}" if avg_rating else "N/A"

    story.append(Paragraph(f"<b>9. CONTEST & PROBLEM INTELLIGENCE — {c_name.upper()}</b>", styles['SectionTitle']))
    story.append(Paragraph(
        f"Official performance telemetry captured during the LeetCode contest window ({c_date}). "
        f"A total of <b>{participants} students participated</b> ({att_pct}% college participation rate), "
        f"achieving an average rating benchmark of <b>{rating_str}</b>.",
        styles['NormalText']
    ))
    story.append(Spacer(1, 6))

    # Problem breakdown table
    p_table_data = [
        [
            Paragraph("<b>Problem Tag</b>", styles['TH']),
            Paragraph("<b>Difficulty Level</b>", styles['TH']),
            Paragraph("<b>Total College Solves</b>", styles['TH']),
            Paragraph("<b>Participant Solve Rate %</b>", styles['TH']),
            Paragraph("<b>Target Learning Outcome</b>", styles['THLeft'])
        ]
    ]

    outcomes = {
        "Q1": "Array & String manipulation, conditional simulation, basic hash maps.",
        "Q2": "Prefix sums, two-pointer search, sliding window, binary search.",
        "Q3": "Tree traversal, graph shortest paths, dynamic programming states.",
        "Q4": "Advanced segment trees, bitmask DP, hard topological graph problems."
    }

    for p in p_breakdown:
        q_tag = p.get("question", "Q1")
        diff_str = p.get("difficulty", "Easy")
        diff_color = "#10B981" if "Easy" in diff_str else ("#F59E0B" if "Med" in diff_str else "#EF4444")
        solved_cnt = p.get("solved", 0)
        solved_pct = p.get("solved_pct", 0.0)

        p_table_data.append([
            Paragraph(f"<b>{q_tag}</b>", styles['TDBold']),
            Paragraph(f"<font color='{diff_color}'><b>{diff_str}</b></font>", styles['TD']),
            Paragraph(f"<b>{solved_cnt}</b>", styles['TDBold']),
            Paragraph(f"<b>{solved_pct}%</b>", styles['TD']),
            Paragraph(outcomes.get(q_tag, "Algorithmic problem solving."), styles['TDLeft']),
        ])

    col_widths_p = [1.2*inch, 1.4*inch, 1.5*inch, 1.8*inch, 4.8*inch]
    t_p = Table(p_table_data, colWidths=col_widths_p, repeatRows=1)
    t_p.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), COLOR_PRIMARY_NAVY),
        ('GRID', (0, 0), (-1, -1), 0.5, COLOR_BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, COLOR_BG_LIGHT])
    ]))
    story.append(t_p)
    story.append(Spacer(1, 8))

    # Top contest rankers table
    if top_rankers:
        story.append(Paragraph("<b>Top Official Contest Finishers:</b>", styles['NormalText']))
        story.append(Spacer(1, 3))
        
        ranker_table_data = [
            [
                Paragraph("<b>Rank</b>", styles['TH']),
                Paragraph("<b>Register No</b>", styles['TH']),
                Paragraph("<b>Student Name</b>", styles['THLeft']),
                Paragraph("<b>Dept</b>", styles['TH']),
                Paragraph("<b>Year</b>", styles['TH']),
                Paragraph("<b>Contest Solved</b>", styles['TH']),
                Paragraph("<b>Rating</b>", styles['TH']),
                Paragraph("<b>Score</b>", styles['TH'])
            ]
        ]
        
        for r_idx, r in enumerate(top_rankers[:8], 1):
            rating_v = r.get("contest_rating")
            r_str = f"{rating_v:.1f}" if rating_v else "N/A"
            c_solved = r.get("contest_solved_current", 0)
            
            ranker_table_data.append([
                Paragraph(str(r_idx), styles['TD']),
                Paragraph(r.get("reg_no", ""), styles['TD']),
                Paragraph(f"<b>{r.get('name', '')}</b>", styles['TDLeft']),
                Paragraph(r.get("department", ""), styles['TD']),
                Paragraph(r.get("year", ""), styles['TD']),
                Paragraph(f"<font color='#059669'><b>{c_solved}/4</b></font>", styles['TDBold']),
                Paragraph(r_str, styles['TD']),
                Paragraph(f"<b>{c_solved * 3 + 2}</b>", styles['TDBold']),
            ])
            
        t_r = Table(ranker_table_data, colWidths=[0.5*inch, 1.3*inch, 2.8*inch, 1.1*inch, 0.8*inch, 1.4*inch, 1.4*inch, 1.4*inch], repeatRows=1)
        t_r.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), COLOR_SECONDARY_BLUE),
            ('GRID', (0, 0), (-1, -1), 0.5, COLOR_BORDER),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 2.5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, COLOR_BG_LIGHT])
        ]))
        story.append(t_r)

    story.append(Spacer(1, 10))
    return story
