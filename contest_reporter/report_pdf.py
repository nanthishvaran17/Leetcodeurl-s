"""
report_pdf.py — Generates a 1-page executive PDF summary using ReportLab.
"""
import logging
import io
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm, cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether,
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

log = logging.getLogger(__name__)

# ─── Brand colours ────────────────────────────────────────────────────────────
NAVY  = colors.HexColor("#1B2A4A")
GOLD  = colors.HexColor("#F5B800")
GREEN = colors.HexColor("#1DB954")
RED   = colors.HexColor("#E53935")
LIGHT = colors.HexColor("#F0F4FA")
GRAY  = colors.HexColor("#B0BEC5")
WHITE = colors.white


def _styles():
    base = getSampleStyleSheet()
    return {
        "title":    ParagraphStyle("title",    fontSize=18, textColor=WHITE,
                                   fontName="Helvetica-Bold", alignment=TA_CENTER,
                                   spaceAfter=2),
        "subtitle": ParagraphStyle("subtitle", fontSize=10, textColor=GOLD,
                                   fontName="Helvetica-Bold", alignment=TA_CENTER,
                                   spaceAfter=4),
        "section":  ParagraphStyle("section",  fontSize=11, textColor=WHITE,
                                   fontName="Helvetica-Bold", spaceBefore=6, spaceAfter=2),
        "body":     ParagraphStyle("body",      fontSize=9,  textColor=colors.black,
                                   fontName="Helvetica",      spaceAfter=4, leading=14),
        "italic":   ParagraphStyle("italic",    fontSize=9,  textColor=colors.HexColor("#444"),
                                   fontName="Helvetica-Oblique", spaceAfter=6, leading=14),
        "kpi_label": ParagraphStyle("kpi_label", fontSize=8, textColor=GRAY,
                                    fontName="Helvetica", alignment=TA_CENTER),
        "kpi_value": ParagraphStyle("kpi_value", fontSize=20, textColor=NAVY,
                                    fontName="Helvetica-Bold", alignment=TA_CENTER),
        "kpi_delta": ParagraphStyle("kpi_delta", fontSize=10,
                                    fontName="Helvetica-Bold", alignment=TA_CENTER),
    }


def _fmt_time(seconds: Optional[int]) -> str:
    if not seconds:
        return "—"
    m, s = divmod(seconds, 60)
    return f"{m}m {s}s"


def _delta_str(delta: Optional[float], positive_good: bool = True) -> str:
    if delta is None:
        return "—"
    sign = "▲" if delta >= 0 else "▼"
    return f"{sign} {abs(delta):.0f}"


def generate_pdf(
    analysis: dict,
    settings: dict,
    out_dir: Path,
) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    today = datetime.now().strftime("%Y-%m-%d")
    path = out_dir / f"LeetCode_Report_{today}.pdf"

    student  = settings.get("student", {})
    name     = student.get("name", "Student")
    reg_no   = student.get("reg_no", "")
    college  = student.get("college", "Nandha Engineering College")
    dept     = student.get("department", "CSE (Cyber Security)")

    S = _styles()
    doc = SimpleDocTemplate(
        str(path),
        pagesize=A4,
        leftMargin=18*mm, rightMargin=18*mm,
        topMargin=14*mm,  bottomMargin=14*mm,
    )

    story = []

    # ── Header banner ──────────────────────────────────────────────────────────
    banner_data = [[
        Paragraph(college, S["title"]),
    ]]
    banner = Table(banner_data, colWidths=[doc.width])
    banner.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), NAVY),
        ("TOPPADDING",    (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING",   (0, 0), (-1, -1), 8),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 8),
        ("ROUNDEDCORNERS", [4]),
    ]))
    story.append(banner)
    story.append(Spacer(1, 4*mm))

    # Sub-header row
    story.append(Paragraph(
        f"{dept}  •  {name}  ({reg_no})  •  Weekly LeetCode Contest Report",
        ParagraphStyle("meta", fontSize=9, textColor=NAVY, fontName="Helvetica-Bold",
                       alignment=TA_CENTER, spaceAfter=2)
    ))
    story.append(Paragraph(
        f"Generated: {datetime.now().strftime('%d %B %Y, %I:%M %p')}  |  "
        f"Contest: {analysis.get('latest_title', 'N/A')}",
        ParagraphStyle("meta2", fontSize=8, textColor=GRAY, fontName="Helvetica",
                       alignment=TA_CENTER, spaceAfter=4)
    ))

    story.append(HRFlowable(width="100%", thickness=1.5, color=GOLD, spaceAfter=5*mm))

    # ── KPI tiles ──────────────────────────────────────────────────────────────
    rd = analysis.get("rating_delta")
    rk = analysis.get("rank_delta")
    rating_delta_color = GREEN if (rd or 0) >= 0 else RED
    rank_delta_color   = GREEN if (rk or 0) <= 0 else RED

    kpi_data = [[
        [Paragraph("CURRENT RATING", S["kpi_label"]),
         Paragraph(f"{analysis.get('current_rating', 0):.0f}", S["kpi_value"]),
         Paragraph(_delta_str(rd), ParagraphStyle("d1", fontSize=10, fontName="Helvetica-Bold",
                                                   alignment=TA_CENTER, textColor=rating_delta_color))],

        [Paragraph("GLOBAL RANK", S["kpi_label"]),
         Paragraph(f"#{(analysis.get('current_ranking') or 0):,}", S["kpi_value"]),
         Paragraph(_delta_str(rk, positive_good=False),
                   ParagraphStyle("d2", fontSize=10, fontName="Helvetica-Bold",
                                  alignment=TA_CENTER, textColor=rank_delta_color))],

        [Paragraph("PROBLEMS SOLVED", S["kpi_label"]),
         Paragraph(
             f"{analysis.get('problems_solved') or 0} / {analysis.get('total_problems') or 4}",
             S["kpi_value"]),
         Paragraph("", S["kpi_label"])],

        [Paragraph("STREAK", S["kpi_label"]),
         Paragraph(f"{analysis.get('streak', 0)}w", S["kpi_value"]),
         Paragraph("🔥 Consecutive", ParagraphStyle("d3", fontSize=7, fontName="Helvetica",
                                                      alignment=TA_CENTER))],
    ]]
    col_w = doc.width / 4
    kpi_table = Table(kpi_data, colWidths=[col_w]*4, rowHeights=[58])
    kpi_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), LIGHT),
        ("BOX",         (0, 0), (-1, -1), 0.5, GRAY),
        ("INNERGRID",   (0, 0), (-1, -1), 0.5, GRAY),
        ("VALIGN",      (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING",  (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 4),
    ]))
    story.append(kpi_table)
    story.append(Spacer(1, 5*mm))

    # ── 5-Week rolling average ─────────────────────────────────────────────────
    avg5 = analysis.get("rolling_avg_5")
    if avg5:
        story.append(Paragraph(
            f"5-Week Rolling Average Rating: <b>{avg5:.1f}</b>  |  "
            f"Finish Time: <b>{_fmt_time(analysis.get('finish_time_s'))}</b>",
            ParagraphStyle("avg", fontSize=9, fontName="Helvetica",
                           alignment=TA_CENTER, spaceAfter=4, textColor=NAVY)
        ))

    story.append(HRFlowable(width="100%", thickness=0.5, color=LIGHT, spaceAfter=3*mm))

    # ── Narrative ──────────────────────────────────────────────────────────────
    _section_banner(story, doc, "📝  Performance Summary", S)
    story.append(Paragraph(analysis.get("narrative", "No data available."), S["italic"]))
    story.append(Spacer(1, 3*mm))

    # ── Tag weakness table ─────────────────────────────────────────────────────
    weak_tags = analysis.get("weak_tags") or []
    if weak_tags:
        _section_banner(story, doc, "📉  Topic Weakness (Lowest Accuracy)", S)
        tag_rows = [["Topic Tag", "Accuracy", "Attempted", "Accepted"]]
        for t in weak_tags:
            tag_rows.append([
                t["tag"],
                f"{t['accuracy']}%",
                str(t["total"]),
                str(t["accepted"]),
            ])
        tag_table = Table(tag_rows, colWidths=[90*mm, 30*mm, 30*mm, 30*mm])
        tag_table.setStyle(TableStyle([
            ("BACKGROUND",  (0, 0), (-1, 0), NAVY),
            ("TEXTCOLOR",   (0, 0), (-1, 0), WHITE),
            ("FONTNAME",    (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE",    (0, 0), (-1, -1), 9),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, LIGHT]),
            ("BOX",         (0, 0), (-1, -1), 0.5, GRAY),
            ("INNERGRID",   (0, 0), (-1, -1), 0.5, GRAY),
            ("ALIGN",       (1, 0), (-1, -1), "CENTER"),
            ("TOPPADDING",  (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING",(0, 0), (-1, -1), 4),
        ]))
        story.append(tag_table)
        story.append(Spacer(1, 3*mm))

    # ── Milestones ─────────────────────────────────────────────────────────────
    if analysis.get("milestones_crossed"):
        for m in analysis["milestones_crossed"]:
            story.append(Paragraph(
                f"🎉  Rating milestone crossed this week: <b>{m}</b>! Outstanding achievement.",
                ParagraphStyle("milestone", fontSize=10, fontName="Helvetica-Bold",
                               textColor=GREEN, spaceAfter=3)
            ))

    # ── Rating history mini-table ───────────────────────────────────────────────
    hist = analysis.get("history") or []
    if hist:
        _section_banner(story, doc, "📊  Recent Contest History", S)
        recent = list(reversed(hist[:8]))  # last 8, oldest first
        hist_rows = [["Contest", "Rating", "Δ Rating", "Rank", "Solved"]]
        prev_r = None
        for h in recent:
            r = h.get("rating") or 0
            delta = round(r - prev_r, 1) if prev_r is not None else 0
            prev_r = r
            hist_rows.append([
                h.get("contest_title", "")[:32],
                f"{r:.0f}",
                f"+{delta:.0f}" if delta >= 0 else f"{delta:.0f}",
                f"#{(h.get('ranking') or 0):,}",
                f"{h.get('problems_solved') or 0}/{h.get('total_problems') or 4}",
            ])
        hist_table = Table(hist_rows, colWidths=[90*mm, 22*mm, 22*mm, 28*mm, 20*mm])
        hist_table.setStyle(TableStyle([
            ("BACKGROUND",  (0, 0), (-1, 0), NAVY),
            ("TEXTCOLOR",   (0, 0), (-1, 0), WHITE),
            ("FONTNAME",    (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE",    (0, 0), (-1, -1), 8),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, LIGHT]),
            ("BOX",         (0, 0), (-1, -1), 0.5, GRAY),
            ("INNERGRID",   (0, 0), (-1, -1), 0.5, GRAY),
            ("ALIGN",       (1, 0), (-1, -1), "CENTER"),
            ("TOPPADDING",  (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING",(0, 0), (-1, -1), 3),
        ]))
        story.append(hist_table)

    # ── Footer ─────────────────────────────────────────────────────────────────
    story.append(Spacer(1, 6*mm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=GRAY, spaceAfter=3*mm))
    story.append(Paragraph(
        f"Auto-generated by NEC LeetCode Contest Reporter  •  "
        f"Data source: LeetCode Public GraphQL API  •  {today}",
        ParagraphStyle("footer", fontSize=7, textColor=GRAY, fontName="Helvetica",
                       alignment=TA_CENTER)
    ))

    doc.build(story)
    log.info(f"[PDF] Saved: {path}")
    return path


def _section_banner(story, doc, text: str, S: dict):
    data = [[Paragraph(text, S["section"])]]
    t = Table(data, colWidths=[doc.width])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), NAVY),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(t)
    story.append(Spacer(1, 2*mm))
