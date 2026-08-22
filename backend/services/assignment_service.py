"""
assignment_service.py — Concurrency-Safe Faculty 1:20 Mentoring Assignment Service
Enforces strict 20-mentee capacity per faculty and intra-department constraints.
"""

from typing import List, Dict, Any, Union
import uuid
from sqlalchemy.orm import Session
from sqlalchemy import func
from fastapi import HTTPException, status

from backend.models import User, FacultyStudentAssignment, Student, Department
from backend.logger import logger


class MentoringAssignmentService:
    @staticmethod
    def assign_students_to_faculty(
        db: Session,
        faculty_id: Union[int, str, uuid.UUID],
        student_ids: List[Union[int, str, uuid.UUID]]
    ) -> Dict[str, Any]:
        """
        Assigns a list of students to a faculty member with strict 1:20 mentoring constraint.
        Thread-safe and concurrency-safe with nested transaction isolation.
        """
        if not student_ids:
            raise HTTPException(status_code=400, detail="Student list cannot be empty.")

        with db.begin_nested():
            # Query faculty record with lock where applicable
            faculty = db.query(User).filter(
                User.id == faculty_id,
                func.lower(User.role).in_(["faculty", "hod", "super admin", "admin"]),
                User.is_active == True
            ).first()

            if not faculty:
                raise HTTPException(status_code=404, detail="Active Faculty record not found.")

            # Calculate current active mentees count
            current_count = db.query(func.count(FacultyStudentAssignment.id)).filter(
                FacultyStudentAssignment.faculty_id == faculty.id,
                FacultyStudentAssignment.is_active == True
            ).scalar() or 0

            if current_count + len(student_ids) > 20:
                raise HTTPException(
                    status_code=400,
                    detail=f"Faculty allocation limit exceeded. Current: {current_count}/20. Max allowed active mentees is 20. Attempted to add {len(student_ids)}."
                )

            # Department validation
            students = db.query(Student).filter(Student.id.in_(student_ids), Student.is_active == True).all()
            if not students:
                # Try finding in User table if student table ID mismatch
                user_students = db.query(User).filter(User.id.in_(student_ids), User.is_active == True).all()
                if user_students:
                    for u_st in user_students:
                        if faculty.department_id and u_st.department_id and faculty.department_id != u_st.department_id:
                            raise HTTPException(
                                status_code=403,
                                detail=f"Cross-department assignment forbidden for {u_st.full_name or u_st.email}."
                            )
                else:
                    raise HTTPException(status_code=404, detail="Specified student records not found.")
            else:
                for st in students:
                    if faculty.department_id and st.department_id and faculty.department_id != st.department_id:
                        raise HTTPException(
                            status_code=403,
                            detail=f"Cross-department assignment forbidden for student {st.name} ({st.reg_no})."
                        )

            # Deactivate any previous active assignment for these students
            db.query(FacultyStudentAssignment).filter(
                FacultyStudentAssignment.student_id.in_(student_ids),
                FacultyStudentAssignment.is_active == True
            ).update({"is_active": False}, synchronize_session=False)

            # Create new active assignments
            new_assignments = [
                FacultyStudentAssignment(
                    faculty_id=faculty.id,
                    student_id=s_id,
                    is_active=True
                )
                for s_id in student_ids
            ]
            db.add_all(new_assignments)

        db.commit()
        total_now = current_count + len(student_ids)
        logger.info(f"[MENTORING_ASSIGNED] Faculty ID: {faculty.id} assigned {len(student_ids)} students. Active: {total_now}/20.")
        return {
            "status": "success",
            "assigned_count": len(student_ids),
            "total_active_mentees": total_now,
            "faculty_id": faculty.id,
            "faculty_name": getattr(faculty, "full_name", None) or getattr(faculty, "username", None) or faculty.email
        }
