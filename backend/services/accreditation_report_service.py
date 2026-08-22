"""
accreditation_report_service.py — Automated NAAC & NBA Accreditation Report Studio

Generates institutional compliance metrics and downloadable audit packages:
1. NAAC Criteria 2.3 (Teaching-Learning Process):
   - Problem-solving methodologies, experiential learning, and coding lab engagement.
2. NAAC Criteria 5.1 & 5.2 (Student Support & Progression):
   - Capability enhancement in competitive coding and career development progression.
3. NBA Criterion 4 & 5 (Students' Performance & Faculty Contributions):
   - Professional coding benchmarking, 1:20 mentoring outcome logs, and continuous evaluation audits.
4. Export Studio:
   - Official watermarked executive audit summary and structured CSV/Excel dumps.
"""

import io
import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.models import Student, Department, User, LeetCodeProfileStats, FacultyStudentAssignment


class AccreditationReportService:

    @classmethod
    def generate_accreditation_metrics(cls, db: Session, dept_id: Optional[int] = None) -> Dict[str, Any]:
        """Calculates NAAC & NBA quantitative benchmarking metrics."""
        query_students = db.query(Student).filter(Student.is_active == True)
        if dept_id:
            query_students = query_students.filter(Student.department_id == dept_id)

        total_students = query_students.count() or 1
        
        active_coders = db.query(Student).join(Student.stats).filter(
            LeetCodeProfileStats.total_solved >= 10
        )
        if dept_id:
            active_coders = active_coders.filter(Student.department_id == dept_id)
        active_coders_count = active_coders.count()

        advanced_coders = db.query(Student).join(Student.stats).filter(
            LeetCodeProfileStats.total_solved >= 100
        )
        if dept_id:
            advanced_coders = advanced_coders.filter(Student.department_id == dept_id)
        advanced_coders_count = advanced_coders.count()

        # Mentoring metrics
        total_faculty = db.query(User).filter(
            User.role.in_(["Faculty", "faculty", "Staff", "staff"]),
            User.is_active == True
        )
        if dept_id:
            total_faculty = total_faculty.filter(User.department_id == dept_id)
        faculty_count = total_faculty.count() or 1

        total_assignments = db.query(FacultyStudentAssignment).filter(
            FacultyStudentAssignment.is_active == True
        )
        assigned_students_count = total_assignments.count()

        # Department matrix
        depts = db.query(Department).all()
        dept_benchmarks = []
        for d in depts:
            d_students = db.query(Student).filter(Student.department_id == d.id, Student.is_active == True).count()
            d_solved = db.query(func.sum(LeetCodeProfileStats.total_solved)).join(
                Student, Student.id == LeetCodeProfileStats.student_id
            ).filter(Student.department_id == d.id).scalar() or 0
            
            dept_benchmarks.append({
                "dept_code": d.code,
                "dept_name": d.name,
                "total_students": d_students,
                "total_problems_solved": d_solved,
                "avg_per_student": round(d_solved / d_students, 1) if d_students > 0 else 0,
                "naac_compliance_score": min(100, int((d_solved / (d_students * 50 or 1)) * 100))
            })

        return {
            "institution": "Nandha Engineering College (Autonomous)",
            "report_type": "NAAC & NBA Continuous Quality Improvement (CQI) Audit Record",
            "generated_at": datetime.datetime.utcnow().strftime("%d-%m-%Y %H:%M UTC"),
            "academic_year": "2025–2026",
            "naac_criteria_2_3": {
                "metric_title": "Experiential & Problem-Solving Methodologies (Coding Platforms)",
                "total_enrolled": total_students,
                "actively_participating": active_coders_count,
                "participation_percentage": round((active_coders_count / total_students) * 100, 1),
                "target_benchmark_met": (active_coders_count / total_students) >= 0.70
            },
            "naac_criteria_5_1": {
                "metric_title": "Competitive Coding Capability Enhancement",
                "advanced_tier_coders": advanced_coders_count,
                "advanced_percentage": round((advanced_coders_count / total_students) * 100, 1),
                "placement_readiness_index": f"{round((advanced_coders_count / total_students) * 100, 1)}%"
            },
            "nba_mentoring_audit": {
                "faculty_mentors": faculty_count,
                "mentee_ratio": f"1:{round(assigned_students_count / faculty_count, 1) if faculty_count else 20}",
                "assigned_students": assigned_students_count,
                "coverage_pct": round((assigned_students_count / total_students) * 100, 1)
            },
            "department_benchmarks": dept_benchmarks
        }


accreditation_report_service = AccreditationReportService()
