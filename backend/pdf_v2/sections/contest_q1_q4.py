"""
contest_q1_q4.py — Contest Q1-Q4 Problem Intelligence Section
"""
from reportlab.platypus import Paragraph, Table, TableStyle, Spacer, KeepTogether
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.colors import HexColor, white
from reportlab.lib.units import cm
from typing import Any, Dict, List, Optional

C_BLUE    = HexColor("#2563EB")
C_INDIGO  = HexColor("#4F46E5")
C_GREEN   = HexColor("#10B981")
C_AMBER   = HexColor("#D97706")
C_RED     = HexColor("#DC2626")
C_SLATE   = HexColor("#475569")
C_BG      = HexColor("#F8FAFC")
C_BORDER  = HexColor("#E2E8F0")

DIFF_COLORS = {"Easy": C_GREEN, "Medium": C_AMBER, "Hard": C_RED}

_H2 = ParagraphStyle("q_h2", fontName="Helvetica-Bold", fontSize=10, textColor=C_BLUE, spaceAfter=4)
_H3 = ParagraphStyle("q_h3", fontName="Helvetica-Bold", fontSize=8, textColor=C_INDIGO, spaceAfter=3)
_BODY = ParagraphStyle("q_body", fontName="Helvetica", fontSize=7, textColor=C_SLATE, spaceAfter=2)

def _safe(v, default="N/A"):
    if v is None or v == "" or str(v).strip() == "":
        return default
    return str(v)

def _pct(v):
    if v is None:
        return "N/A"
    try:
        return f"{float(v):.1f}%"
    except Exception:
        return "N/A"


def build_contest_q1q4(dataset: Dict[str, Any], page_width: float) -> List:
    """Builds the Q1-Q4 Contest Problem Intelligence section."""
    elements = []
    contest_data = dataset.get("contest_intelligence", {})
    if not contest_data:
        contest_data = dataset.get("current_contest", {})

    q_data = contest_data.get("q1q4_stats", [])
    if not q_data:
        q_data = contest_data.get("problem_stats", [])

    elements.append(Paragraph("9. Contest Q1–Q4 Problem Intelligence", _H2))
    elements.append(Spacer(1, 4))

    contest_name = _safe(contest_data.get("contest_name") or dataset.get("metadata", {}).get("period_w0"))
    contest_date = _safe(contest_data.get("contest_date") or dataset.get("metadata", {}).get("report_date"))
    elements.append(Paragraph(
        f"<b>Contest:</b> {contest_name} &nbsp;&nbsp; <b>Date:</b> {contest_date}",
        _BODY
    ))
    elements.append(Spacer(1, 6))

    if not q_data:
        elements.append(Paragraph(
            "Q1-Q4 problem-level data is not available for this contest. "
            "Official problem data will be populated once participant results are synced.",
            _BODY
        ))
        return elements

    # Q1-Q4 summary table
    header = ["Q#", "Difficulty", "College Solves", "Solve Rate", "Acceptance Rate", "Avg Time (s)"]
    rows = [header]
    for q in q_data:
        diff = _safe(q.get("difficulty"), "—")
        diff_color = DIFF_COLORS.get(diff, C_SLATE)
        rows.append([
            _safe(q.get("label", q.get("q_label", "Q?"))),
            diff,
            _safe(q.get("college_solves", q.get("solves"))),
            _pct(q.get("solve_rate")),
            _pct(q.get("acceptance_rate")),
            _safe(q.get("avg_time_seconds", q.get("avg_time"))),
        ])

    col_w = [page_width * w for w in [0.06, 0.14, 0.18, 0.15, 0.20, 0.15]]
    if sum(col_w) > page_width:
        col_w = [None] * len(header)

    style = TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), C_INDIGO),
        ("TEXTCOLOR",  (0, 0), (-1, 0), white),
        ("FONTNAME",   (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE",   (0, 0), (-1, -1), 7.5),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [C_BG, white]),
        ("GRID",       (0, 0), (-1, -1), 0.4, C_BORDER),
        ("ALIGN",      (0, 0), (-1, -1), "CENTER"),
        ("VALIGN",     (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ])

    tbl = Table(rows, colWidths=col_w if col_w[0] else None)
    tbl.setStyle(style)
    elements.append(KeepTogether(tbl))
    elements.append(Spacer(1, 8))

    # Chart
    try:
        from backend.pdf_v2.charts import Q1Q4Chart
        q_labels = [q.get("label", q.get("q_label", f"Q{i+1}")) for i, q in enumerate(q_data)]
        rates = [q.get("solve_rate") for q in q_data]
        if any(r is not None for r in rates):
            chart = Q1Q4Chart(
                q_labels=q_labels, solve_rates=rates,
                width=page_width * 0.55, height=5 * cm,
                title="Q1–Q4 Solve Rate (%)", subtitle="College participant solve rates by problem"
            )
            elements.append(chart)
            elements.append(Spacer(1, 6))
    except Exception:
        pass

    # Insights
    insights = []
    for q in q_data:
        label = q.get("label", q.get("q_label", "Q?"))
        sr = q.get("solve_rate")
        if sr is not None:
            try:
                if float(sr) < 20:
                    insights.append(f"<b>{label}</b>: Only {sr:.1f}% solve rate — high difficulty observed.")
                elif float(sr) > 80:
                    insights.append(f"<b>{label}</b>: Strong {sr:.1f}% solve rate — good problem-solving performance.")
            except Exception:
                pass

    if insights:
        elements.append(Paragraph("<b>Key Insights:</b>", _H3))
        for ins in insights[:4]:
            elements.append(Paragraph(f"• {ins}", _BODY))

    return elements
