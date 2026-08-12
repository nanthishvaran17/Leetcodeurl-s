import datetime
import uuid
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.models import Student, Department, Section, LeetCodeProfileStats, ContestParticipation, HODSnapshot

def build_college_overview(db: Session, filters: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Builds the verified dataset for the College Executive Overview report."""
    query = db.query(Student).filter(Student.is_active == True)
    
    if filters:
        if "academic_year" in filters:
            # We don't have an academic year on Student yet in a unified way, but if needed we can add it
            pass
            
    students = query.all()
    total_students = len(students)
    
    verified_students = 0
    pending_students = 0
    failed_students = 0
    
    total_problems_solved = 0
    easy_solved = 0
    medium_solved = 0
    hard_solved = 0
    
    official_participants = set()
    virtual_participants = set()
    
    departments_summary = {}
    
    # Track distributions
    distribution = {
        "Above 500": 0,
        "250-500": 0,
        "101-250": 0,
        "Less than 100": 0,
        "Not Yet Started": 0
    }
    
    top_students = []

    for s in students:
        dept_name = s.department.name if s.department else "Unknown"
        if dept_name not in departments_summary:
            departments_summary[dept_name] = {
                "total": 0,
                "verified": 0,
                "total_solved": 0,
                "official_participants": 0,
                "virtual_participants": 0
            }
        
        departments_summary[dept_name]["total"] += 1
        
        st = s.stats
        if not st:
            pending_students += 1
            departments_summary[dept_name]["verified"] += 0
            distribution["Not Yet Started"] += 1
            continue
            
        if st.validation_status == "verified":
            verified_students += 1
            departments_summary[dept_name]["verified"] += 1
            
            solved = st.total_solved or 0
            total_problems_solved += solved
            departments_summary[dept_name]["total_solved"] += solved
            easy_solved += (st.easy_solved or 0)
            medium_solved += (st.medium_solved or 0)
            hard_solved += (st.hard_solved or 0)
            
            if solved > 500:
                distribution["Above 500"] += 1
            elif solved >= 250:
                distribution["250-500"] += 1
            elif solved > 100:
                distribution["101-250"] += 1
            elif solved > 0:
                distribution["Less than 100"] += 1
            else:
                distribution["Not Yet Started"] += 1
                
            student_data = {
                "reg_no": s.reg_no,
                "name": s.name,
                "dept": dept_name,
                "year": s.year_level,
                "total_solved": solved,
                "easy": st.easy_solved or 0,
                "medium": st.medium_solved or 0,
                "hard": st.hard_solved or 0,
                "rating": st.contest_rating
            }
            top_students.append(student_data)
        else:
            if st.sync_status == "failed" or st.sync_status == "mismatch":
                failed_students += 1
            else:
                pending_students += 1
            distribution["Not Yet Started"] += 1
            
        # Check participation
        participations = s.contest_participations
        has_official = False
        has_virtual = False
        for p in participations:
            if p.participation_type == "OFFICIAL":
                official_participants.add(s.id)
                has_official = True
            elif p.participation_type == "VIRTUAL":
                virtual_participants.add(s.id)
                has_virtual = True
                
        if has_official:
            departments_summary[dept_name]["official_participants"] += 1
        if has_virtual:
            departments_summary[dept_name]["virtual_participants"] += 1

    # ZERO DATA PROTECTION
    if verified_students == 0:
        total_problems_solved = None
        average_solved = None
        official_part_count = None
        virtual_part_count = None
        data_status = "INVALID"
        message = "⚠️ No verified data available. Report cannot be generated."
    else:
        average_solved = round(total_problems_solved / verified_students, 2)
        official_part_count = len(official_participants)
        virtual_part_count = len(virtual_participants)
        data_status = "READY" if verified_students > (total_students * 0.9) else "PARTIAL"
        message = None

    not_participated = total_students - len(official_participants)

    top_students = sorted(top_students, key=lambda x: x["total_solved"], reverse=True)[:10]

    report_dataset = {
        "reportId": str(uuid.uuid4()),
        "reportType": "COLLEGE_EXECUTIVE",
        "generatedAt": datetime.datetime.utcnow().isoformat(),
        "verifiedAt": datetime.datetime.utcnow().isoformat(),
        "dataStatus": data_status,
        "message": message,
        "metrics": {
            "totalStudents": total_students,
            "verifiedStudents": verified_students,
            "pendingStudents": pending_students,
            "failedStudents": failed_students,
            "totalSolved": total_problems_solved,
            "averageSolved": average_solved,
            "easySolved": easy_solved,
            "mediumSolved": medium_solved,
            "hardSolved": hard_solved,
            "officialParticipants": official_part_count,
            "virtualParticipants": virtual_part_count,
            "notParticipated": not_participated
        },
        "departmentSummary": departments_summary,
        "distribution": distribution,
        "topStudents": top_students
    }
    
    return report_dataset

def build_department_report(db: Session, dept_name: str, year: Optional[str] = None, section: Optional[str] = None) -> Dict[str, Any]:
    """Builds the verified dataset for a specific department/year/section."""
    query = db.query(Student).filter(Student.is_active == True)
    
    # Needs a join with Department
    query = query.join(Department).filter(Department.name == dept_name)
    
    if year:
        query = query.filter(Student.year_level == year)
    if section:
        query = query.join(Section).filter(Section.name == section)
        
    students = query.all()
    total_students = len(students)
    
    verified_students = 0
    total_problems_solved = 0
    official_participants = set()
    virtual_participants = set()
    
    distribution = {
        "Above 500": 0,
        "250-500": 0,
        "101-250": 0,
        "Less than 100": 0,
        "Not Yet Started": 0
    }
    
    student_rows = []
    
    for s in students:
        st = s.stats
        if not st or st.validation_status != "verified":
            distribution["Not Yet Started"] += 1
            student_rows.append({
                "reg_no": s.reg_no,
                "name": s.name,
                "year": s.year_level,
                "section": s.section.name if s.section else "",
                "total_solved": None,
                "rating": None,
                "status": "UNVERIFIED"
            })
            continue
            
        verified_students += 1
        solved = st.total_solved or 0
        total_problems_solved += solved
        
        if solved > 500:
            distribution["Above 500"] += 1
        elif solved >= 250:
            distribution["250-500"] += 1
        elif solved > 100:
            distribution["101-250"] += 1
        elif solved > 0:
            distribution["Less than 100"] += 1
        else:
            distribution["Not Yet Started"] += 1
            
        student_rows.append({
            "reg_no": s.reg_no,
            "name": s.name,
            "year": s.year_level,
            "section": s.section.name if s.section else "",
            "total_solved": solved,
            "easy": st.easy_solved,
            "medium": st.medium_solved,
            "hard": st.hard_solved,
            "rating": st.contest_rating,
            "status": "VERIFIED"
        })
        
        has_official = False
        has_virtual = False
        for p in s.contest_participations:
            if p.participation_type == "OFFICIAL":
                official_participants.add(s.id)
                has_official = True
            elif p.participation_type == "VIRTUAL":
                virtual_participants.add(s.id)
                has_virtual = True
                
    # Sort students by total_solved descending
    student_rows = sorted(student_rows, key=lambda x: x["total_solved"] or -1, reverse=True)
    
    # Zero Data Protection
    if verified_students == 0:
        total_problems_solved = None
        average_solved = None
        data_status = "INVALID"
        message = "⚠️ No verified data available for this selection."
    else:
        average_solved = round(total_problems_solved / verified_students, 2)
        data_status = "READY" if verified_students > (total_students * 0.9) else "PARTIAL"
        message = None
        
    title_parts = [dept_name]
    if year: title_parts.append(f"{year} Year")
    if section: title_parts.append(f"Sec {section}")
    report_title = " - ".join(title_parts) + " Report"

    return {
        "reportId": str(uuid.uuid4()),
        "reportType": "DEPARTMENT_REPORT",
        "title": report_title,
        "generatedAt": datetime.datetime.utcnow().isoformat(),
        "verifiedAt": datetime.datetime.utcnow().isoformat(),
        "dataStatus": data_status,
        "message": message,
        "metrics": {
            "totalStudents": total_students,
            "verifiedStudents": verified_students,
            "totalSolved": total_problems_solved,
            "averageSolved": average_solved,
            "officialParticipants": len(official_participants),
            "virtualParticipants": len(virtual_participants)
        },
        "distribution": distribution,
        "topStudents": student_rows[:10],
        "allStudents": student_rows
    }

def build_all_students_report(db: Session) -> Dict[str, Any]:
    """Builds the full master report for all 273 students."""
    students = db.query(Student).filter(Student.is_active == True).all()
    total_students = len(students)
    
    student_rows = []
    verified_students = 0
    
    for idx, s in enumerate(students, start=1):
        st = s.stats
        if not st or st.validation_status != "verified":
            student_rows.append({
                "s_no": idx,
                "reg_no": s.reg_no,
                "name": s.name,
                "dept": s.department.code if s.department else "",
                "year": s.year_level,
                "section": s.section.name if s.section else "",
                "username": s.username or "",
                "url": s.leetcode_url or "",
                "easy": None,
                "medium": None,
                "hard": None,
                "total_solved": None,
                "rating": None,
                "global_rank": None,
                "status": "UNVERIFIED"
            })
            continue
            
        verified_students += 1
        student_rows.append({
            "s_no": idx,
            "reg_no": s.reg_no,
            "name": s.name,
            "dept": s.department.code if s.department else "",
            "year": s.year_level,
            "section": s.section.name if s.section else "",
            "username": s.username or "",
            "url": s.leetcode_url or "",
            "easy": st.easy_solved,
            "medium": st.medium_solved,
            "hard": st.hard_solved,
            "total_solved": st.total_solved,
            "rating": st.contest_rating,
            "global_rank": st.contest_global_ranking,
            "status": "VERIFIED"
        })
        
    student_rows = sorted(student_rows, key=lambda x: x["total_solved"] or -1, reverse=True)
    for i, row in enumerate(student_rows):
        row["rank"] = i + 1 if row["status"] == "VERIFIED" else "-"

    return {
        "reportId": str(uuid.uuid4()),
        "reportType": "ALL_STUDENTS_MASTER",
        "title": "All Students Master Report",
        "generatedAt": datetime.datetime.utcnow().isoformat(),
        "verifiedAt": datetime.datetime.utcnow().isoformat(),
        "dataStatus": "READY" if verified_students > (total_students * 0.9) else "PARTIAL",
        "metrics": {
            "totalStudents": total_students,
            "verifiedStudents": verified_students,
        },
        "allStudents": student_rows
    }

def build_official_contest_report(db: Session) -> Dict[str, Any]:
    """Builds a dataset containing ONLY official contest participation."""
    participations = db.query(ContestParticipation).filter(ContestParticipation.participation_type == "OFFICIAL").all()
    
    rows = []
    for p in participations:
        rows.append({
            "contest_name": p.contest_name,
            "date": p.contest_date,
            "student_name": p.student.name,
            "reg_no": p.student.reg_no,
            "dept": p.student.department.code if p.student.department else "",
            "problems_solved": p.problems_solved,
            "total_problems": p.total_problems,
            "rank": p.contest_rank,
            "verified_at": p.verified_at.isoformat() if p.verified_at else None
        })
        
    return {
        "reportId": str(uuid.uuid4()),
        "reportType": "OFFICIAL_CONTEST",
        "title": "Official Contest Participation Report",
        "generatedAt": datetime.datetime.utcnow().isoformat(),
        "verifiedAt": datetime.datetime.utcnow().isoformat(),
        "dataStatus": "READY",
        "metrics": {
            "totalParticipations": len(rows),
        },
        "participations": rows
    }
