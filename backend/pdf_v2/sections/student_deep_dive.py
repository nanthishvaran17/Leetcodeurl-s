"""
SECTION 8: Student Deep Dive & Elite Candidate Scorecards
"""

from reportlab.platypus import Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib import colors
from reportlab.lib.units import inch

from backend.pdf_v2.styles import (
    COLOR_PRIMARY_NAVY, COLOR_SECONDARY_BLUE, COLOR_BG_LIGHT, COLOR_BG_CARD,
    COLOR_BORDER, COLOR_BRAND_BLUE, COLOR_SUCCESS, COLOR_EASY, COLOR_MEDIUM, COLOR_HARD
)


def build_student_deep_dive(dataset: dict, styles: dict, table_style: TableStyle, max_scorecards: int = 8) -> list:
    story = []
    deep_dives = dataset.get("student_deep_dives", [])
    
    story.append(Paragraph("<b>8. STUDENT DEEP DIVE & ELITE CANDIDATE SCORECARDS</b>", styles['SectionTitle']))
    story.append(Paragraph(
        "Individual competitive programming dossiers for top institutional performers and department toppers, "
        "including difficulty breakdown, primary languages, DSA focus, and contest trajectory.",
        styles['NormalText']
    ))
    story.append(Spacer(1, 8))

    # Sort deep dives by total solved descending
    sorted_deep_dives = sorted(deep_dives, key=lambda s: s.get("metrics", {}).get("current_solved", 0), reverse=True)

    for idx, s in enumerate(sorted_deep_dives[:max_scorecards], 1):
        m = s.get("metrics", {})
        diff = s.get("difficulty", {})
        dsa = s.get("dsa_intelligence", {})
        lang = s.get("language_intelligence", {})
        contest = s.get("contest_detail", {})
        risk = s.get("ai_risk_insights", {})

        tot_s = m.get("current_solved", 0)
        easy_cnt = diff.get("easy", 0)
        med_cnt = diff.get("medium", 0)
        hard_cnt = diff.get("hard", 0)
        easy_pct = diff.get("easy_pct", 0.0)
        med_pct = diff.get("medium_pct", 0.0)
        hard_pct = diff.get("hard_pct", 0.0)

        rating_val = m.get("contest_rating")
        rating_str = f"{rating_val:.1f}" if rating_val else "N/A"
        rank_val = m.get("global_rank")
        rank_str = f"#{rank_val:,}" if rank_val else "N/A"

        prim_lang = lang.get("primary_language", "Java")
        top_topic = dsa.get("top_topic", "Arrays")
        weak_topic = dsa.get("weak_topic", "Dynamic Programming")

        # Top 3 languages list
        lang_list = [f"{l.get('language_name')} ({l.get('problems_solved')})" for l in lang.get("languages", [])[:3]]
        lang_str = ", ".join(lang_list) if lang_list else prim_lang

        # 3-week history
        h_weeks = s.get("history_3_weeks", [])
        h_str = " -> ".join([f"{h.get('week_label', '')}: {h.get('solved', 0):,}" for h in h_weeks]) if h_weeks else "N/A"

        card_data = [
            # Header Row
            [
                Paragraph(f"<b>#{idx} • {s.get('name')}</b> ({s.get('reg_no')}) — {s.get('department')} ({s.get('year')} Year)", styles['THLeft']),
                Paragraph(f"<b>LeetCode ID:</b> @{s.get('username')}", styles['TH'])
            ],
            # Main Details
            [
                Table([
                    [
                        Paragraph(f"<b>Total Solved:</b> <font size=9 color='#1D4ED8'><b>{tot_s:,}</b></font>", styles['NormalText']),
                        Paragraph(f"<font color='#059669'><b>Easy:</b> {easy_cnt} ({easy_pct}%)</font>", styles['NormalText']),
                        Paragraph(f"<font color='#D97706'><b>Medium:</b> {med_cnt} ({med_pct}%)</font>", styles['NormalText']),
                        Paragraph(f"<font color='#DC2626'><b>Hard:</b> {hard_cnt} ({hard_pct}%)</font>", styles['NormalText'])
                    ],
                    [
                        Paragraph(f"<b>Contest Rating:</b> <b>{rating_str}</b>", styles['NormalText']),
                        Paragraph(f"<b>Global Rank:</b> <b>{rank_str}</b>", styles['NormalText']),
                        Paragraph(f"<b>Top DSA:</b> {top_topic}", styles['NormalText']),
                        Paragraph(f"<b>Growth Area:</b> {weak_topic}", styles['NormalText'])
                    ],
                    [
                        Paragraph(f"<b>Languages:</b> {lang_str}", styles['NormalText']),
                        Paragraph(f"<b>3-Wk Solved Trend:</b> {h_str}", styles['NormalText']),
                        Paragraph(f"<b>Contest Attendance:</b> {'Attended' if contest.get('attended') else 'Absent'}", styles['NormalText']),
                        Paragraph(f"<b>Risk Level:</b> <font color='#059669'><b>{m.get('risk_level', 'LOW')}</b></font>", styles['NormalText'])
                    ]
                ], colWidths=[2.6*inch, 2.6*inch, 2.6*inch, 2.6*inch]),
                ""
            ]
        ]

        t_card = Table(card_data, colWidths=[8.0*inch, 2.7*inch])
        t_card.setStyle(TableStyle([
            ('SPAN', (0, 0), (0, 0)),
            ('SPAN', (1, 0), (1, 0)),
            ('SPAN', (0, 1), (1, 1)),
            ('BACKGROUND', (0, 0), (-1, 0), COLOR_SECONDARY_BLUE),
            ('BACKGROUND', (0, 1), (-1, 1), COLOR_BG_LIGHT),
            ('GRID', (0, 0), (-1, -1), 0.5, COLOR_BORDER),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 2.5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5),
        ]))
        story.append(t_card)
        story.append(Spacer(1, 6))

    story.append(Spacer(1, 10))
    return story
