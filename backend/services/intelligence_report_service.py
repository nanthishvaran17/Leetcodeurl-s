import datetime
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session

from backend.services.weekly_intelligence_service import generate_live_weekly_intelligence_data
from backend.services.report_validators import reconcile_report_dataset

def build_intelligence_dataset(
    db: Session, 
    department: Optional[str] = None, 
    year: Optional[str] = None,
    current_user: Any = None
) -> Dict[str, Any]:
    """
    Builds the authoritative canonical dataset for the Friday Weekly LeetCode Intelligence Report.
    Queries live student metrics, contest results, topic breakdowns, and language distributions.
    Applies strict data reconciliation gate.
    """
    live_data = generate_live_weekly_intelligence_data(
        db=db,
        department=department,
        year=year,
        current_user=current_user
    )

    # Perform mandatory cross-table data reconciliation gate
    reconciliation = reconcile_report_dataset(live_data)
    official_status = reconciliation.get("official_status", "OFFICIAL")

    # Provide normalized helper mappings for backwards compatibility and easy PDF consumption
    dept_map = {}
    for d in live_data.get("department_intelligence", []):
        d_code = d.get("department", "CSE")
        dept_map[d_code] = {
            "w0": d.get("current_solved", 0),
            "w1": d.get("prev_solved", 0),
            "w2": d.get("prev_prev_solved", 0),
            "weekly_new": d.get("weekly_new", 0),
            "growth_pct": d.get("growth_pct", 0.0),
            "total_students": d.get("total_students", 0),
            "active_students": d.get("active_students", 0),
            "avg_solved": d.get("avg_solved", 0.0),
            "avg_rating": d.get("avg_rating"),
            "contest_participants": d.get("contest_participants", 0),
            "coordinator": d.get("coordinator", "Department Faculty Coordinator")
        }

    year_map = {}
    for y in live_data.get("year_intelligence", []):
        y_code = y.get("year", "I")
        year_map[y_code] = {
            "w0": y.get("current_solved", 0),
            "w1": y.get("prev_solved", 0),
            "w2": y.get("prev_prev_solved", 0),
            "weekly_new": y.get("weekly_new", 0),
            "growth_pct": y.get("growth_pct", 0.0),
            "total_students": y.get("total_students", 0),
            "active_students": y.get("active_students", 0),
            "avg_solved": y.get("avg_solved", 0.0),
            "avg_rating": y.get("avg_rating"),
            "batch_label": y.get("batch_label", "")
        }

    topic_map = {}
    for t in live_data.get("dsa_topic_intelligence", {}).get("top_topics", []):
        t_name = t.get("topic_name", "General")
        topic_map[t_name] = {
            "w0": t.get("problems_solved", 0),
            "student_count": t.get("student_count", 0),
            "pct_of_total": t.get("pct_of_total", 0.0),
            "tier": t.get("tier", "Fundamental")
        }

    lang_map = {}
    for l in live_data.get("language_intelligence", {}).get("top_languages", []):
        l_name = l.get("language_name", "General")
        lang_map[l_name] = {
            "w0": l.get("problems_solved", 0),
            "student_count": l.get("student_count", 0),
            "pct_of_total": l.get("pct_of_total", 0.0)
        }

    meta = live_data.get("report_metadata", {})
    exec_dash = live_data.get("executive_dashboard", {})
    reporting_win = meta.get("reporting_window", {})

    dataset = {
        "metadata": {
            "report_date": meta.get("report_date", datetime.date.today().strftime("%d-%m-%Y")),
            "period_w0": reporting_win.get("current_week", {}).get("week_label", "W518"),
            "period_w1": reporting_win.get("previous_week", {}).get("week_label", "W517"),
            "period_w2": reporting_win.get("prev_prev_week", {}).get("week_label", "W516"),
            "window_str": reporting_win.get("window_str", "W516 -> W517 -> W518"),
            "generated_at": meta.get("generated_at", datetime.datetime.now().strftime("%d %b %Y, %I:%M %p IST")),
            "snapshot_id": f"SNAP_{reporting_win.get('current_week', {}).get('week_label', 'W518')}_{meta.get('report_date', '').replace('-', '')}",
            "institution": meta.get("institution", "NANDHA ENGINEERING COLLEGE (AUTONOMOUS)"),
            "official_status": official_status,
            "audit_hash": meta.get("audit_hash", "")
        },
        "summary": {
            "total_students": exec_dash.get("total_students", 0),
            "active_students": exec_dash.get("active_students", 0),
            "improved_students": exec_dash.get("improved_students", 0),
            "contest_participants": exec_dash.get("contest_participants", 0),
            "total_solved": exec_dash.get("total_problems_solved", 0),
            "weekly_new_solved": exec_dash.get("weekly_new_solved", 0),
            "growth_pct": exec_dash.get("growth_pct", 0.0),
            "average_rating": exec_dash.get("average_rating"),
            "risk_distribution": exec_dash.get("risk_distribution", {}),
            "category_distribution": exec_dash.get("category_distribution", {})
        },
        "reconciliation": reconciliation,
        "departments": dept_map,
        "department_list": live_data.get("department_intelligence", []),
        "years": year_map,
        "year_list": live_data.get("year_intelligence", []),
        "topics": topic_map,
        "topic_list": live_data.get("dsa_topic_intelligence", {}).get("top_topics", []),
        "languages": lang_map,
        "language_list": live_data.get("language_intelligence", {}).get("top_languages", []),
        "year_dsa_matrix": live_data.get("dsa_topic_intelligence", {}).get("year_matrix", {}),
        "dept_dsa_matrix": live_data.get("dsa_topic_intelligence", {}).get("dept_matrix", {}),
        "year_lang_matrix": live_data.get("language_intelligence", {}).get("year_matrix", {}),
        "dept_lang_matrix": live_data.get("language_intelligence", {}).get("dept_matrix", {}),
        "contest_intelligence": live_data.get("contest_intelligence", {}),
        "students": live_data.get("student_3_week_comparison", []),
        "student_deep_dives": live_data.get("student_deep_dives", []),
        "top_performers_cohorts": live_data.get("top_performers_cohorts", {}),
        "data_availability": live_data.get("data_availability", {}),
        "institutional_trend": live_data.get("institutional_trend", []),
        "raw_live_data": live_data
    }

    return dataset
