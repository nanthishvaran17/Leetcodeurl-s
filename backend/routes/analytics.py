from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional

from backend.database import get_db
from backend.models import Student, Department, Section, LeetCodeProfileStats, WeeklyStudentProgress, WeeklySessionSnapshot
from backend.schemas import StudentOut
from backend.insights import get_student_insights
from backend.gamification import calculate_section_battles

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])

@router.get("/department-comparison")
def compare_departments(db: Session = Depends(get_db)):
    departments = db.query(Department).all()
    results = []

    for dept in departments:
        students = db.query(Student).filter(Student.department_id == dept.id, Student.is_active == True).all()
        total_stud = len(students)
        if total_stud == 0:
            continue

        total_solved = sum((s.stats.total_solved if s.stats else 0) for s in students)
        avg_solved = round(total_solved / total_stud, 1)

        weekly_prog_total = 0
        active_count = 0
        for s in students:
            prog = db.query(WeeklyStudentProgress).filter(WeeklyStudentProgress.student_id == s.id).order_by(WeeklyStudentProgress.id.desc()).first()
            if prog:
                weekly_prog_total += prog.weekly_progress
                if prog.weekly_progress > 0:
                    active_count += 1

        avg_progress = round(weekly_prog_total / total_stud, 1)
        participation = round((active_count / total_stud * 100), 1)

        top_stud = max(students, key=lambda x: (x.stats.total_solved if x.stats else 0), default=None)

        results.append({
            "department_id": dept.id,
            "department_name": dept.name,
            "department_code": dept.code,
            "total_students": total_stud,
            "active_students": active_count,
            "participation_rate": participation,
            "avg_solved": avg_solved,
            "avg_progress": avg_progress,
            "top_student_name": top_stud.name if top_stud else "N/A"
        })

    return results

@router.get("/compare-students")
def compare_students(ids: str = Query(..., description="Comma separated student IDs e.g. 1,2"), db: Session = Depends(get_db)):
    try:
        id_list = [int(x.strip()) for x in ids.split(",") if x.strip()]
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid student IDs format.")

    students = db.query(Student).filter(Student.id.in_(id_list)).all()
    comparison_data = []

    for s in students:
        st_out = StudentOut.from_orm(s)
        latest_prog = db.query(WeeklyStudentProgress).filter(WeeklyStudentProgress.student_id == s.id).order_by(WeeklyStudentProgress.id.desc()).first()
        if latest_prog:
            st_out.college_rank = latest_prog.college_rank
            st_out.dept_rank = latest_prog.dept_rank
            st_out.year_rank = latest_prog.year_rank
            st_out.section_rank = latest_prog.section_rank
            st_out.weekly_progress = latest_prog.weekly_progress
            st_out.streak_count = latest_prog.streak_count
            st_out.consistency_score = latest_prog.consistency_score
            st_out.badge_list = latest_prog.badge_list or []

        insights = get_student_insights(db, s.id)
        comparison_data.append({
            "student": st_out,
            "insights": insights
        })

    return comparison_data

@router.get("/data-quality")
def get_data_quality_dashboard(db: Session = Depends(get_db)):
    students = db.query(Student).filter(Student.is_active == True).all()
    total = len(students)

    ok_count = 0
    missing_link = 0
    invalid_link = 0
    not_found = 0
    data_unavailable = 0

    issues_list = []

    for s in students:
        st = s.stats
        status = st.status if st else "DATA UNAVAILABLE"

        if status == "OK":
            ok_count += 1
        elif status == "MISSING LINK":
            missing_link += 1
            issues_list.append({"student_id": s.id, "reg_no": s.reg_no, "name": s.name, "dept": s.department.code if s.department else "", "issue": "Missing LeetCode Profile URL"})
        elif status == "INVALID LINK":
            invalid_link += 1
            issues_list.append({"student_id": s.id, "reg_no": s.reg_no, "name": s.name, "dept": s.department.code if s.department else "", "issue": "Invalid LeetCode Profile URL"})
        elif status == "PROFILE NOT FOUND":
            not_found += 1
            issues_list.append({"student_id": s.id, "reg_no": s.reg_no, "name": s.name, "dept": s.department.code if s.department else "", "issue": f"Username '{s.username}' not found on LeetCode"})
        else:
            data_unavailable += 1
            issues_list.append({"student_id": s.id, "reg_no": s.reg_no, "name": s.name, "dept": s.department.code if s.department else "", "issue": "Data network/fetch error"})

    health_score = round((ok_count / total * 100), 1) if total > 0 else 100.0

    return {
        "total_students": total,
        "valid_profiles": ok_count,
        "missing_links": missing_link,
        "invalid_links": invalid_link,
        "profile_not_found": not_found,
        "data_unavailable": data_unavailable,
        "health_score_percentage": health_score,
        "issues_list": issues_list
    }

@router.get("/section-battles")
def get_section_battles_leaderboard(db: Session = Depends(get_db)):
    return calculate_section_battles(db)
