"""
historical_trend.py — Weekly Historical Trend Section
"""
from reportlab.platypus import Paragraph, Table, TableStyle, Spacer, KeepTogether
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor, white
from reportlab.lib.units import cm
from typing import Any, Dict, List, Optional

C_BLUE   = HexColor("#2563EB")
C_INDIGO = HexColor("#4F46E5")
C_GREEN  = HexColor("#10B981")
C_AMBER  = HexColor("#D97706")
C_SLATE  = HexColor("#475569")
C_BG     = HexColor("#F8FAFC")
C_BORDER = HexColor("#E2E8F0")

_H2 = ParagraphStyle("t_h2", fontName="Helvetica-Bold", fontSize=10, textColor=C_BLUE, spaceAfter=4)
_BODY = ParagraphStyle("t_body", fontName="Helvetica", fontSize=7, textColor=C_SLATE, spaceAfter=2)
_CAP = ParagraphStyle("t_cap", fontName="Helvetica", fontSize=6.5, textColor=C_SLATE, spaceAfter=2)

def _safe(v, default="N/A"):
    if v is None or str(v).strip() == "":
        return default
    return str(v)

def _num(v, default="N/A"):
    if v is None:
        return default
    try:
        return f"{int(v):,}"
    except Exception:
        return str(v)


def build_historical_trend(dataset: Dict[str, Any], page_width: float) -> List:
    """Builds the weekly historical trend section with table + charts."""
    elements = []
    weekly_trend = dataset.get("weekly_trend", [])
    if not weekly_trend:
        weekly_trend = dataset.get("historical_snapshots", [])

    elements.append(Paragraph("10. Weekly Historical Trend", _H2))
    elements.append(Spacer(1, 4))

    if not weekly_trend:
        elements.append(Paragraph(
            "Historical trend data is not available. Data will populate as weekly snapshots accumulate.",
            _BODY
        ))
        return elements

    # Trend table
    header = ["Week", "Contest", "Date", "Status", "Students", "Total Solved", "New Solved", "Participants", "Avg Rating"]
    rows = [header]
    for entry in weekly_trend:
        rows.append([
            _safe(entry.get("week_label", entry.get("period_w0", entry.get("week")))),
            _safe(entry.get("contest_name")),
            _safe(entry.get("contest_date", entry.get("session_date"))),
            _safe(entry.get("status", "FINAL")),
            _num(entry.get("total_students", entry.get("student_count"))),
            _num(entry.get("total_solved", entry.get("cumulative_solved"))),
            _num(entry.get("weekly_new_solved", entry.get("delta_solved"))),
            _num(entry.get("contest_participants", entry.get("participants"))),
            _safe(entry.get("avg_rating")),
        ])

    col_pcts = [0.07, 0.16, 0.09, 0.08, 0.09, 0.11, 0.10, 0.11, 0.09]
    col_w = [page_width * p for p in col_pcts]
    style = TableStyle([
        ("BACKGROUND",    (0, 0), (-1, 0), C_BLUE),
        ("TEXTCOLOR",     (0, 0), (-1, 0), white),
        ("FONTNAME",      (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE",      (0, 0), (-1, -1), 7),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [C_BG, white]),
        ("GRID",          (0, 0), (-1, -1), 0.4, C_BORDER),
        ("ALIGN",         (0, 0), (-1, -1), "CENTER"),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING",    (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ])
    tbl = Table(rows, colWidths=col_w)
    tbl.setStyle(style)
    elements.append(KeepTogether(tbl))
    elements.append(Spacer(1, 8))

    # Charts row
    chart_w = page_width * 0.47
    chart_h = 4.5 * cm
    try:
        from backend.pdf_v2.charts import InstitutionalTrendChart, ContestParticipationChart

        weeks = [e.get("week_label", e.get("period_w0", "")) for e in weekly_trend]
        cumulative = [e.get("total_solved", e.get("cumulative_solved")) for e in weekly_trend]
        participants = [e.get("contest_participants", e.get("participants")) for e in weekly_trend]

        if any(v is not None for v in cumulative):
            c1 = InstitutionalTrendChart(
                weeks=weeks, values=cumulative,
                width=chart_w, height=chart_h,
                title="Cumulative Solved Trend", subtitle="Total problems solved across all weeks"
            )
            elements.append(c1)
            elements.append(Spacer(1, 4))

        if any(v is not None for v in participants):
            c2 = ContestParticipationChart(
                weeks=weeks, values=participants,
                width=chart_w, height=chart_h,
                title="Contest Participation Trend", subtitle="Students attending each weekly contest"
            )
            elements.append(c2)
    except Exception:
        pass

    return elements
