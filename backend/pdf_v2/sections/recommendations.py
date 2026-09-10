"""
recommendations.py — Data-Driven Recommendations Section
"""
from reportlab.platypus import Paragraph, Table, TableStyle, Spacer, KeepTogether
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor, white
from reportlab.lib.units import cm
from typing import Any, Dict, List

C_BLUE   = HexColor("#2563EB")
C_INDIGO = HexColor("#4F46E5")
C_GREEN  = HexColor("#10B981")
C_AMBER  = HexColor("#D97706")
C_RED    = HexColor("#DC2626")
C_SLATE  = HexColor("#475569")
C_BG     = HexColor("#F8FAFC")
C_BORDER = HexColor("#E2E8F0")

_H2   = ParagraphStyle("r_h2",   fontName="Helvetica-Bold", fontSize=10, textColor=C_BLUE,   spaceAfter=4)
_H3   = ParagraphStyle("r_h3",   fontName="Helvetica-Bold", fontSize=8,  textColor=C_INDIGO, spaceAfter=3)
_BODY = ParagraphStyle("r_body", fontName="Helvetica",      fontSize=7.5,textColor=C_SLATE,  spaceAfter=3)
_REC  = ParagraphStyle("r_rec",  fontName="Helvetica",      fontSize=7,  textColor=HexColor("#1E293B"), spaceAfter=5, leftIndent=12)

PRIORITY_COLOR = {"HIGH": C_RED, "MEDIUM": C_AMBER, "LOW": C_GREEN}


def generate_recommendations(dataset: Dict[str, Any]) -> List[Dict]:
    """
    Generates data-driven recommendations from the analytics dataset.
    Every recommendation must be grounded in actual metrics.
    Returns a list of {priority, category, recommendation, metric} dicts.
    """
    recs = []
    summary = dataset.get("summary", {})
    
    # Safe list extraction (handling both list and dict formats)
    dept_raw = dataset.get("department_list") or dataset.get("departments", [])
    if isinstance(dept_raw, dict):
        dept_data = [{"name": k, **v} for k, v in dept_raw.items()]
    elif isinstance(dept_raw, list):
        dept_data = dept_raw
    else:
        dept_data = []

    year_raw = dataset.get("year_list") or dataset.get("years", [])
    if isinstance(year_raw, dict):
        year_data = [{"year": k, **v} for k, v in year_raw.items()]
    elif isinstance(year_raw, list):
        year_data = year_raw
    else:
        year_data = []

    risk_data = summary.get("risk_distribution") or dataset.get("risk_distribution", {})
    topic_data = dataset.get("topic_list") or dataset.get("dsa_topics", [])
    contest_data = dataset.get("contest_intelligence", {})

    # Risk-based recommendations
    inactive = risk_data.get("INACTIVE", 0)
    at_risk = risk_data.get("AT_RISK", 0)
    total = summary.get("total_students", 0)
    if inactive > 0 and total > 0:
        pct = round(inactive / total * 100, 1)
        recs.append({
            "priority": "HIGH",
            "category": "Student Engagement",
            "recommendation": f"Intervention required for {inactive} inactive students ({pct}% of cohort). "
                              f"These students have shown zero activity in recent weeks.",
            "metric": f"{inactive} students / {pct}% inactive rate",
        })
    if at_risk > 0:
        recs.append({
            "priority": "HIGH",
            "category": "Academic Risk",
            "recommendation": f"{at_risk} students are classified AT_RISK based on declining activity, "
                              f"stagnant solved count, and/or poor contest engagement.",
            "metric": f"{at_risk} at-risk students",
        })

    # Department-based recommendations
    if dept_data:
        sorted_dept = sorted(dept_data, key=lambda d: d.get("current_solved", d.get("total_solved", d.get("w0", 0))) if isinstance(d, dict) else 0)
        weakest = [d for d in sorted_dept if isinstance(d, dict)][:2]
        for d in weakest:
            dept_name = d.get("department", d.get("name", d.get("dept", "Unknown")))
            solved = d.get("current_solved", d.get("total_solved", d.get("w0", 0)))
            if solved is not None and total > 0:
                recs.append({
                    "priority": "MEDIUM",
                    "category": "Department Focus",
                    "recommendation": f"{dept_name} department requires attention — lowest solved count ({solved:,}). "
                                      f"Faculty coordinator should review student engagement.",
                    "metric": f"{solved:,} total solved",
                })

        # Contest participation
        low_part = [
            d for d in dept_data if isinstance(d, dict) and 
            (d.get("contest_participation_pct", d.get("participation_pct", 0)) < 20) and 
            (d.get("total_students", d.get("students", 0)) > 10)
        ]
        for d in low_part[:2]:
            dept_name = d.get("department", d.get("name", d.get("dept", "Unknown")))
            pct = d.get("contest_participation_pct", d.get("participation_pct", 0))
            recs.append({
                "priority": "MEDIUM",
                "category": "Contest Participation",
                "recommendation": f"{dept_name}: Only {pct:.0f}% contest participation. "
                                  f"Recommend mandatory contest engagement and pre-contest preparation sessions.",
                "metric": f"{pct:.0f}% participation rate",
            })

    # Year-based recommendations
    if year_data:
        sorted_yr = sorted(year_data, key=lambda y: y.get("avg_solved", 0) if isinstance(y, dict) else 0)
        for y in [yr for yr in sorted_yr if isinstance(yr, dict)][:1]:
            yr_name = y.get("year", y.get("name", "Unknown"))
            avg = y.get("avg_solved", 0)
            if avg is not None and avg < 100:
                recs.append({
                    "priority": "MEDIUM",
                    "category": "Batch Development",
                    "recommendation": f"{yr_name} batch has the lowest average solved count ({avg:.0f}). "
                                      f"Structured DSA bootcamp and beginner problem-set recommended.",
                    "metric": f"{avg:.0f} avg solved",
                })

    # Topic gap recommendations
    if topic_data:
        ds_solves = {t.get("topic_name", t.get("topic", "")): t.get("problems_solved", t.get("avg_solved", 0)) for t in topic_data if isinstance(t, dict)}
        critical_topics = ["Dynamic Programming", "Graphs", "Trees", "Binary Search"]

        for topic in critical_topics:
            coverage = ds_solves.get(topic)
            if coverage is not None and coverage < 20:
                recs.append({
                    "priority": "LOW",
                    "category": "DSA Focus",
                    "recommendation": f"Low {topic} coverage (avg {coverage:.0f} solves). "
                                      f"Recommend focused workshop on {topic} patterns.",
                    "metric": f"{coverage:.0f} avg {topic} solves",
                })

    # Contest recommendation
    contest_pct = summary.get("contest_participation_pct")
    if contest_pct is not None:
        try:
            if float(contest_pct) < 30:
                recs.append({
                    "priority": "HIGH",
                    "category": "Contest Culture",
                    "recommendation": f"Overall contest participation is only {contest_pct:.1f}%. "
                                      f"Recommend institutionalizing Sunday contest as a mandatory academic activity.",
                    "metric": f"{contest_pct:.1f}% overall participation",
                })
        except Exception:
            pass

    if not recs:
        recs.append({
            "priority": "LOW",
            "category": "General",
            "recommendation": "Insufficient data for targeted recommendations. "
                              "Ensure weekly data sync is complete before the next report.",
            "metric": "N/A",
        })

    return recs[:12]


def build_recommendations(dataset: Dict[str, Any], page_width: float) -> List:
    """Builds the recommendations section from live analytics data."""
    elements = []
    elements.append(Paragraph("12. Recommendations & Action Plan", _H2))
    elements.append(Spacer(1, 4))
    elements.append(Paragraph(
        "The following recommendations are generated automatically from the validated "
        "analytics dataset. Each item is grounded in actual measured metrics — no generic filler.",
        _BODY
    ))
    elements.append(Spacer(1, 6))

    recs = generate_recommendations(dataset)
    if not recs:
        elements.append(Paragraph("No recommendations generated — insufficient data.", _BODY))
        return elements

    # Group by priority
    for priority in ["HIGH", "MEDIUM", "LOW"]:
        group = [r for r in recs if r.get("priority") == priority]
        if not group:
            continue
        color = PRIORITY_COLOR.get(priority, C_SLATE)
        elements.append(Paragraph(f"<font color='#{color.hexval()}'><b>{priority} PRIORITY</b></font>", _H3))
        for rec in group:
            cat = rec.get("category", "")
            msg = rec.get("recommendation", "")
            metric = rec.get("metric", "")
            text = f"<b>[{cat}]</b> {msg}"
            if metric and metric != "N/A":
                text += f" <font color='#475569'><i>(Metric: {metric})</i></font>"
            elements.append(Paragraph(f"• {text}", _REC))
        elements.append(Spacer(1, 4))

    return elements
