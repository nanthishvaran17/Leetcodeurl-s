import datetime
import json
from typing import Dict, Any, List, Optional
from collections import defaultdict
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.models import (
    Student, Department, WeeklyStudentSnapshot, 
    LeetCodeTopicStats, LeetCodeLanguageStats,
    WeeklyPublicResult, WeeklyVirtualResult
)
from backend.services.reporting_period_service import reporting_period_service
from backend.config.report_config import derive_student_batch

def build_intelligence_dataset(db: Session, current_user: Any = None) -> Dict[str, Any]:
    """
    Builds the massive canonical dataset for the Friday Weekly LeetCode Intelligence Report.
    Fetches exactly 3 weeks of snapshots (Current, W-1, W-2), plus live topics/languages.
    """
    # 1. Determine Reporting Periods
    curr_period_info = reporting_period_service.get_reporting_period()
    curr_id = curr_period_info["reporting_period_id"]
    w1_id = curr_period_info["previous_period_id"]
    
    # Calculate W-2
    w1_start = curr_period_info["previous_week_start"]
    w2_start = w1_start - datetime.timedelta(days=7)
    w2_period_info = reporting_period_service.get_reporting_period(w2_start)
    w2_id = w2_period_info["reporting_period_id"]

    # 2. RBAC - Determine authorized departments
    allowed_dept_ids = None
    if current_user and getattr(current_user, "role", None) not in ("Super Admin", "Principal", "Director"):
        user_dept_id = getattr(current_user, "department_id", None)
        if user_dept_id:
            allowed_dept_ids = [user_dept_id]

    # Query active students
    q_students = db.query(Student).filter(Student.is_active == True)
    if allowed_dept_ids:
        q_students = q_students.filter(Student.department_id.in_(allowed_dept_ids))
    
    active_students = q_students.all()
    active_student_ids = [s.id for s in active_students]

    # Preload Departments
    departments = {d.id: d for d in db.query(Department).all()}

    # 3. Load 3-Week Snapshots
    snapshots = db.query(WeeklyStudentSnapshot).filter(
        WeeklyStudentSnapshot.reporting_period_id.in_([curr_id, w1_id, w2_id]),
        WeeklyStudentSnapshot.student_id.in_(active_student_ids)
    ).all()

    snap_map = defaultdict(lambda: {curr_id: None, w1_id: None, w2_id: None})
    for snap in snapshots:
        snap_map[snap.student_id][snap.reporting_period_id] = snap

    # 4. Load Topic & Language Stats
    topic_stats = db.query(LeetCodeTopicStats).filter(LeetCodeTopicStats.student_id.in_(active_student_ids)).all()
    lang_stats = db.query(LeetCodeLanguageStats).filter(LeetCodeLanguageStats.student_id.in_(active_student_ids)).all()

    # Data Structures for Aggregation
    dept_metrics = defaultdict(lambda: {"w0": 0, "w1": 0, "w2": 0})
    year_metrics = defaultdict(lambda: {"w0": 0, "w1": 0, "w2": 0})
    topic_metrics = defaultdict(lambda: {"w0": 0}) # Topics are generally point-in-time
    lang_metrics = defaultdict(lambda: {"w0": 0})
    
    student_details = []

    # Aggregation Loop
    for st in active_students:
        s_snaps = snap_map[st.id]
        c_snap = s_snaps[curr_id]
        w1_snap = s_snaps[w1_id]
        w2_snap = s_snaps[w2_id]
        
        c_solved = c_snap.primary_solved_count if c_snap else 0
        w1_solved = w1_snap.primary_solved_count if w1_snap else 0
        w2_solved = w2_snap.primary_solved_count if w2_snap else 0

        dept_name = departments[st.department_id].name if st.department_id in departments else "Unknown"
        dept_code = departments[st.department_id].code if st.department_id in departments else "Unknown"
        year_str = derive_student_batch(st.reg_no)

        # Aggregate Dept
        dept_metrics[dept_code]["w0"] += c_solved
        dept_metrics[dept_code]["w1"] += w1_solved
        dept_metrics[dept_code]["w2"] += w2_solved

        # Aggregate Year
        year_metrics[year_str]["w0"] += c_solved
        year_metrics[year_str]["w1"] += w1_solved
        year_metrics[year_str]["w2"] += w2_solved

        # Build Student Info
        student_details.append({
            "id": st.id,
            "reg_no": st.reg_no,
            "name": st.name,
            "dept": dept_code,
            "year": year_str,
            "username": st.username,
            "w0_solved": c_solved,
            "w1_solved": w1_solved,
            "w2_solved": w2_solved,
            "delta_w0_w1": c_solved - w1_solved,
            "c_snap": c_snap
        })

    # Aggregate Topics
    for ts in topic_stats:
        if ts.problems_solved:
            topic_metrics[ts.topic_name or ts.topic_slug]["w0"] += ts.problems_solved

    # Aggregate Languages
    for ls in lang_stats:
        if ls.problems_solved:
            lang_metrics[ls.language_name]["w0"] += ls.problems_solved

    return {
        "metadata": {
            "report_date": curr_period_info["report_date_str"],
            "period_w0": curr_id,
            "period_w1": w1_id,
            "period_w2": w2_id,
            "generated_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        },
        "summary": {
            "total_students": len(active_students),
        },
        "departments": dict(dept_metrics),
        "years": dict(year_metrics),
        "topics": dict(topic_metrics),
        "languages": dict(lang_metrics),
        "students": student_details
    }
