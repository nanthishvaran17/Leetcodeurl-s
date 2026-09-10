"""
engine.py — Master PDF Orchestrator for Friday Weekly LeetCode Intelligence Report.

13-Section dynamic composition. No Student Deep Dive. No hardcoded page count.
Uses the Nandha Intelligence premium chart system for all 13 graphs.

SECTION STRUCTURE:
  1.  Executive Intelligence Dashboard           (header_and_executive)
  2.  Department Intelligence                    (department_and_year)
  3.  Academic Year / Batch Intelligence         (department_and_year)
  4.  DSA Topic Intelligence                     (dsa_and_language)
  5.  Programming Language Intelligence          (dsa_and_language)
  6.  Department x DSA / Language Intelligence   (department_matrices)
  7.  Top Performers & Weekly Improvers          (top_performers_and_cohorts)
  8.  Weekly Contest Intelligence                (contest_and_problems)
  9.  Contest Q1-Q4 Problem Intelligence         (contest_q1_q4)  NEW
  10. Weekly Historical Trend                    (historical_trend) NEW
  11. Risk & Intervention Intelligence           (charts)
  12. Recommendations & Action Plan              (recommendations)  NEW
  13. Data Quality & Audit                       (methodology_and_audit)
"""

import io
from typing import Dict, Any, List
from reportlab.lib.pagesizes import landscape, A4
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate, PageBreak, Spacer, Paragraph
)
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor

from backend.pdf_v2.styles import get_report_styles, get_base_table_style
from backend.pdf_v2.canvas import make_intelligence_numbered_canvas

# Core sections
from backend.pdf_v2.sections.header_and_executive import build_header_and_executive
from backend.pdf_v2.sections.department_and_year import build_department_intelligence, build_year_intelligence
from backend.pdf_v2.sections.dsa_and_language import build_dsa_intelligence, build_language_intelligence
from backend.pdf_v2.sections.department_matrices import build_department_matrices
from backend.pdf_v2.sections.contest_and_problems import build_contest_and_problems
from backend.pdf_v2.sections.top_performers_and_cohorts import build_top_performers_and_cohorts
from backend.pdf_v2.sections.methodology_and_audit import build_methodology_and_audit

# New sections
from backend.pdf_v2.sections.contest_q1_q4 import build_contest_q1q4
from backend.pdf_v2.sections.historical_trend import build_historical_trend
from backend.pdf_v2.sections.recommendations import build_recommendations

# NOTE: student_deep_dive and student_roster are intentionally NOT imported.
# Per spec: "COMPLETELY REMOVE: STUDENT DEEP DIVE & ELITE CANDIDATE SCORECARDS"

_PAGE_W_LANDSCAPE = landscape(A4)[0]  # ~841 pt
_MARGIN = 24
_USABLE_W = _PAGE_W_LANDSCAPE - 2 * _MARGIN

_FALLBACK_STYLE = ParagraphStyle(
    "pdf_fallback", fontName="Helvetica", fontSize=7,
    textColor=HexColor("#94A3B8"), spaceAfter=4
)


def _section_elements_safe(build_fn, *args, section_name: str = "", **kwargs) -> List:
    """Calls a section builder safely; returns a fallback element on any error."""
    try:
        elements = build_fn(*args, **kwargs)
        return elements if elements else []
    except Exception as e:
        try:
            from backend.logger import logger
            logger.warning(f"[PDF_ENGINE] Section '{section_name}' failed: {e}")
        except Exception:
            pass
        return [Paragraph(f"[{section_name}: data unavailable — {type(e).__name__}]", _FALLBACK_STYLE)]


def build_intelligence_pdf(dataset: Dict[str, Any]) -> bytes:
    """
    Builds the official Friday Weekly LeetCode Intelligence PDF.

    Dynamic composition — page count depends on actual data volume.
    All 13 sections included; sections with no data show clear notices.

    GUARANTEE: No student deep dive. No hardcoded contest numbers.
    Student Deep Dive section has been completely removed per spec section 18.
    """
    buffer = io.BytesIO()
    meta = dataset.get("metadata", {})

    doc = SimpleDocTemplate(
        buffer,
        pagesize=landscape(A4),
        rightMargin=_MARGIN,
        leftMargin=_MARGIN,
        topMargin=26,
        bottomMargin=28,
        title="Friday Weekly LeetCode Intelligence Report — Nandha Engineering College",
        author="Nandha LeetCode Intelligence Platform",
    )

    story: List = []
    styles = get_report_styles()
    table_style = get_base_table_style()

    # 1. Executive Intelligence Dashboard
    story.extend(_section_elements_safe(
        build_header_and_executive, dataset, styles, table_style,
        section_name="Executive Dashboard"
    ))
    story.append(PageBreak())

    # 2+3. Department & Academic Year Intelligence
    story.extend(_section_elements_safe(
        build_department_intelligence, dataset, styles, table_style,
        section_name="Department Intelligence"
    ))
    story.append(Spacer(1, 0.3 * cm))
    story.extend(_section_elements_safe(
        build_year_intelligence, dataset, styles, table_style,
        section_name="Academic Year Intelligence"
    ))
    story.append(PageBreak())

    # 4+5. DSA Topic & Language Intelligence
    story.extend(_section_elements_safe(
        build_dsa_intelligence, dataset, styles, table_style,
        section_name="DSA Intelligence"
    ))
    story.append(Spacer(1, 0.3 * cm))
    story.extend(_section_elements_safe(
        build_language_intelligence, dataset, styles, table_style,
        section_name="Language Intelligence"
    ))
    story.append(PageBreak())

    # 6. Department Cross-Matrices
    story.extend(_section_elements_safe(
        build_department_matrices, dataset, styles, table_style,
        section_name="Department Cross-Matrices"
    ))
    story.append(PageBreak())

    # 7. Top Performers & Weekly Improvers
    story.extend(_section_elements_safe(
        build_top_performers_and_cohorts, dataset, styles, table_style,
        section_name="Top Performers"
    ))
    story.append(PageBreak())

    # 8. Weekly Contest Intelligence
    story.extend(_section_elements_safe(
        build_contest_and_problems, dataset, styles, table_style,
        section_name="Contest Intelligence"
    ))

    # 9. Contest Q1-Q4 Problem Intelligence (NEW)
    story.append(Spacer(1, 0.4 * cm))
    story.extend(_section_elements_safe(
        build_contest_q1q4, dataset, _USABLE_W,
        section_name="Contest Q1-Q4"
    ))
    story.append(PageBreak())

    # 10. Weekly Historical Trend (NEW)
    story.extend(_section_elements_safe(
        build_historical_trend, dataset, _USABLE_W,
        section_name="Historical Trend"
    ))
    story.append(PageBreak())

    # 11. Risk & Intervention Intelligence
    risk_data = dataset.get("risk_distribution", {})
    if risk_data:
        try:
            from backend.pdf_v2.charts import RiskDistributionChart
            risk_chart = RiskDistributionChart(
                risk_data=risk_data,
                width=_USABLE_W * 0.62, height=5.5 * cm,
                title="11. Risk & Intervention Intelligence",
                subtitle="Student risk classification — based on activity, solved trend, and contest engagement"
            )
            story.append(risk_chart)
        except Exception as e:
            story.append(Paragraph(f"[Risk chart unavailable: {e}]", _FALLBACK_STYLE))
    story.append(Spacer(1, 0.4 * cm))

    # 12. Recommendations & Action Plan (NEW)
    story.extend(_section_elements_safe(
        build_recommendations, dataset, _USABLE_W,
        section_name="Recommendations"
    ))
    story.append(PageBreak())

    # 13. Data Quality & Audit
    story.extend(_section_elements_safe(
        build_methodology_and_audit, dataset, styles, table_style,
        section_name="Data Quality & Audit"
    ))

    # Build PDF with numbered canvas
    canvas_maker = make_intelligence_numbered_canvas(meta)
    doc.build(story, canvasmaker=canvas_maker)

    return buffer.getvalue()

