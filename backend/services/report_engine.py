import datetime
import uuid
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from backend.models import Student, Department, Section, HODSnapshot, ReportHistory
from backend.services.report_models import ReportConfig, ReportDataset, DataQualitySummary
from backend.services.report_data_service import fetch_normalized_students, fetch_normalized_contests, get_problem_category
from backend.services.report_validators import validate_data_quality

def build_universal_report(db: Session, config: ReportConfig) -> Dict[str, Any]:
    """
    UNIVERSAL REPORT ENGINE
    Single Source of Truth generator that creates normalized datasets for all report types.
    """
    raw_students = db.query(Student).filter((Student.is_active == True) | (Student.is_active.is_(None))).all()
    data_quality = validate_data_quality(raw_students)

    students = fetch_normalized_students(
        db,
        dept_filter=config.department,
        year_filter=config.year
    )

    total_students = len(students)
    verified_students = sum(1 for s in students if s.status == "VERIFIED")
    unverified_students = total_students - verified_students

    total_solved = sum((s.total_solved or 0) for s in students if s.status == "VERIFIED")
    easy_solved = sum((s.easy or 0) for s in students if s.status == "VERIFIED")
    medium_solved = sum((s.medium or 0) for s in students if s.status == "VERIFIED")
    hard_solved = sum((s.hard or 0) for s in students if s.status == "VERIFIED")

    active_solvers = sum(1 for s in students if (s.total_solved or 0) > 0)
    average_solved = round(total_solved / max(verified_students, 1), 2)

    ratings = [s.contest_rating for s in students if s.contest_rating is not None]
    average_rating = round(sum(ratings) / max(len(ratings), 1), 1) if ratings else None
    highest_rating = round(max(ratings), 1) if ratings else None
    highest_solved = max([(s.total_solved or 0) for s in students], default=0)

    # Centralized Category Distribution
    distribution = {
        "Above 500": 0,
        "250-500": 0,
        "100-249": 0,
        "50-99": 0,
        "25-49": 0,
        "1-24": 0,
        "0 Solved": 0
    }

    for s in students:
        cat = get_problem_category(s.total_solved)
        if cat in distribution:
            distribution[cat] += 1
        else:
            distribution[cat] = 1

    # Top Solvers
    top_students = [s.dict() for s in students if s.status == "VERIFIED"][:10]
    all_students_dict = [s.dict() for s in students]

    # Department Breakdown
    dept_breakdown = {}
    for s in students:
        d = s.dept or "CSE"
        if d not in dept_breakdown:
            dept_breakdown[d] = {"total": 0, "verified": 0, "total_solved": 0}
        dept_breakdown[d]["total"] += 1
        if s.status == "VERIFIED":
            dept_breakdown[d]["verified"] += 1
            dept_breakdown[d]["total_solved"] += (s.total_solved or 0)

    # Contest Data if requested
    participations_dict = []
    if config.report_type in ("CONTEST_PERFORMANCE", "OFFICIAL_CONTEST"):
        contests = fetch_normalized_contests(db, dept_filter=config.department, year_filter=config.year)
        participations_dict = [c.dict() for c in contests]

    # Title formatting
    title = f"{config.report_type.replace('_', ' ').title()}"
    if config.department != "ALL":
        title = f"{config.department} {title}"
    if config.year != "ALL":
        title = f"{title} ({config.year} Year)"

    report_id = f"RPT-{datetime.datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

    dataset = {
        "reportId": report_id,
        "reportType": config.report_type,
        "title": title,
        "generatedAt": datetime.datetime.utcnow().isoformat(),
        "verifiedAt": datetime.datetime.utcnow().isoformat(),
        "dataStatus": "READY" if total_students > 0 else "PARTIAL",
        "message": None,
        "config": config.dict(),
        "metrics": {
            "totalStudents": total_students,
            "verifiedStudents": verified_students,
            "unverifiedStudents": unverified_students,
            "activeSolvers": active_solvers,
            "totalSolved": total_solved,
            "averageSolved": average_solved,
            "easySolved": easy_solved,
            "mediumSolved": medium_solved,
            "hardSolved": hard_solved,
            "highestSolved": highest_solved,
            "averageRating": average_rating,
            "highestRating": highest_rating,
            "totalParticipations": len(participations_dict)
        },
        "distribution": distribution,
        "departmentSummary": dept_breakdown,
        "dataQuality": data_quality.dict(),
        "topStudents": top_students,
        "allStudents": all_students_dict,
        "participations": participations_dict
    }

    # Persist in DB ReportHistory for auditability
    history_entry = ReportHistory(
        report_id=report_id,
        report_type=config.report_type,
        title=title,
        filters=config.dict(),
        dataset=dataset,
        status="GENERATED"
    )
    db.add(history_entry)
    db.commit()

    return dataset

# Maintain backwards compatibility aliases
def build_college_overview(db: Session, filters: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    config = ReportConfig(report_type="COLLEGE_EXECUTIVE", department="ALL", year="ALL")
    return build_universal_report(db, config)

def build_department_report(db: Session, dept_name: str, year: Optional[str] = None, section: Optional[str] = None) -> Dict[str, Any]:
    config = ReportConfig(report_type="DEPARTMENT_PERFORMANCE", department=dept_name or "ALL", year=year or "ALL")
    return build_universal_report(db, config)

def build_all_students_report(db: Session) -> Dict[str, Any]:
    config = ReportConfig(report_type="STUDENT_MASTER", department="ALL", year="ALL")
    return build_universal_report(db, config)

def build_official_contest_report(db: Session) -> Dict[str, Any]:
    config = ReportConfig(report_type="CONTEST_PERFORMANCE", department="ALL", year="ALL")
    return build_universal_report(db, config)
