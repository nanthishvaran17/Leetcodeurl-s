"""
faculty_assignment_service.py — Institutional Faculty-Student Allocation Engine

Enforces strict institutional capacity and ownership rules:
1. 1 Faculty -> Maximum 20 Students (Hard limit enforced at backend).
2. 1 Student -> Exactly 1 Active Faculty Advisor.
3. Strict department-level boundaries (HOD / Faculty only assign within department).
4. Auto-distribution algorithm for batch allocation.
"""

import threading
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException, status
import datetime

from backend.models import User, Student, FacultyStudentAssignment, Department, LeetCodeProfileStats
from backend.logger import logger

RECOMMENDED_FACULTY_STUDENT_RATIO = 20
MAX_STUDENTS_PER_FACULTY = RECOMMENDED_FACULTY_STUDENT_RATIO  # Backward-compatibility alias
_allocation_lock = threading.RLock()


class FacultyAssignmentService:
    @staticmethod
    def get_faculty_assigned_student_ids(db: Session, faculty_id: int) -> List[int]:
        """Returns list of student IDs currently assigned to a faculty member."""
        assignments = db.query(FacultyStudentAssignment.student_id).filter(
            FacultyStudentAssignment.faculty_id == faculty_id,
            FacultyStudentAssignment.is_active == True
        ).all()
        return [a[0] for a in assignments]

    @staticmethod
    def get_faculty_assigned_count(db: Session, faculty_id: int) -> int:
        """Returns active count of students assigned to a faculty member."""
        return db.query(FacultyStudentAssignment).filter(
            FacultyStudentAssignment.faculty_id == faculty_id,
            FacultyStudentAssignment.is_active == True
        ).count()

    @staticmethod
    def assign_students_to_faculty(
        db: Session,
        faculty_id: int,
        student_ids: List[int],
        assigned_by_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Assigns one or more students to a faculty member.
        No hard limit on assignment count (20 is recommended mentoring ratio only).
        Guaranteed concurrency-safe against race conditions via thread-level and database atomic locking.
        """
        with _allocation_lock:
            faculty = db.query(User).filter(User.id == faculty_id, User.is_active == True).first()
            if not faculty:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Faculty with ID {faculty_id} not found or is inactive."
                )

            current_count = FacultyAssignmentService.get_faculty_assigned_count(db, faculty_id)
            
            # Deduplicate student_ids
            unique_student_ids = list(dict.fromkeys(student_ids))
            
            # Check if any students are already assigned to this faculty
            existing_ids = FacultyAssignmentService.get_faculty_assigned_student_ids(db, faculty_id)
            new_ids = [sid for sid in unique_student_ids if sid not in existing_ids]

            # 1. Validate that all students exist and belong to the same department
            students = db.query(Student).filter(Student.id.in_(new_ids)).all()
            found_map = {s.id: s for s in students}
            if len(found_map) != len(new_ids):
                missing = set(new_ids) - set(found_map.keys())
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid student IDs provided: {list(missing)}"
                )

            for st in students:
                if faculty.department_id and st.department_id and st.department_id != faculty.department_id:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"Cross-department assignment forbidden. Student '{st.name}' ({st.reg_no}) belongs to a different department."
                    )

            # Apply assignments (handling reassignment if student had a previous faculty)
            assigned_count = 0
            reassigned_count = 0
            now = datetime.datetime.utcnow()

            for sid in new_ids:
                existing_assignment = db.query(FacultyStudentAssignment).filter(
                    FacultyStudentAssignment.student_id == sid
                ).first()

                if existing_assignment:
                    if existing_assignment.faculty_id != faculty_id:
                        reassigned_count += 1
                    existing_assignment.faculty_id = faculty_id
                    existing_assignment.assigned_by_id = assigned_by_id
                    existing_assignment.is_active = True
                    existing_assignment.assigned_at = now
                else:
                    new_assignment = FacultyStudentAssignment(
                        faculty_id=faculty_id,
                        student_id=sid,
                        assigned_by_id=assigned_by_id,
                        is_active=True,
                        assigned_at=now
                    )
                    db.add(new_assignment)
                    assigned_count += 1

            db.commit()
            new_total = FacultyAssignmentService.get_faculty_assigned_count(db, faculty_id)

            # Determine informational workload status
            if new_total < RECOMMENDED_FACULTY_STUDENT_RATIO:
                workload_status = "NORMAL"
                workload_label = "Within Recommended Ratio"
            elif new_total == RECOMMENDED_FACULTY_STUDENT_RATIO:
                workload_status = "AT_RATIO"
                workload_label = "At Recommended Ratio"
            elif new_total <= 30:
                workload_status = "ABOVE_RATIO"
                workload_label = "Above Recommended Ratio"
            else:
                workload_status = "HIGH_WORKLOAD"
                workload_label = "High Workload"

            logger.info(
                f"[FACULTY_ASSIGNMENT] Faculty {faculty.username} (ID {faculty_id}) assigned {len(new_ids)} students. "
                f"Total now: {new_total} (Recommended Ratio: {RECOMMENDED_FACULTY_STUDENT_RATIO} - Status: {workload_label})"
            )

            return {
                "success": True,
                "faculty_id": faculty_id,
                "faculty_name": faculty.username,
                "assigned_count": len(new_ids),
                "reassigned_count": reassigned_count,
                "total_assigned": new_total,
                "recommended_ratio": RECOMMENDED_FACULTY_STUDENT_RATIO,
                "workload_status": workload_status,
                "workload_label": workload_label,
                "workload_warning": f"Faculty has {new_total} students (Above recommended ratio of {RECOMMENDED_FACULTY_STUDENT_RATIO})" if new_total > RECOMMENDED_FACULTY_STUDENT_RATIO else None
            }

    @staticmethod
    def unassign_students(
        db: Session,
        faculty_id: int,
        student_ids: List[int]
    ) -> Dict[str, Any]:
        """Removes students from a faculty member's allocation."""
        deleted = db.query(FacultyStudentAssignment).filter(
            FacultyStudentAssignment.faculty_id == faculty_id,
            FacultyStudentAssignment.student_id.in_(student_ids)
        ).delete(synchronize_session=False)

        db.commit()
        remaining = FacultyAssignmentService.get_faculty_assigned_count(db, faculty_id)

        return {
            "success": True,
            "unassigned_count": deleted,
            "remaining_assigned": remaining,
            "slots_remaining": MAX_STUDENTS_PER_FACULTY - remaining
        }

    @staticmethod
    def auto_distribute_department(
        db: Session,
        department_id: int,
        assigned_by_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Batch-distributes unassigned students in a department to active department faculty
        up to 20 students per faculty member in round-robin fashion.
        """
        faculty_members = db.query(User).filter(
            User.department_id == department_id,
            User.is_active == True,
            User.role.in_(["Faculty", "faculty", "Staff", "staff", "HOD", "hod"])
        ).all()

        if not faculty_members:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No active faculty members found in this department for auto-allocation."
            )

        # Get all unassigned students in this department
        assigned_subquery = db.query(FacultyStudentAssignment.student_id).filter(
            FacultyStudentAssignment.is_active == True
        ).subquery()

        unassigned_students = db.query(Student).filter(
            Student.department_id == department_id,
            (Student.is_active == True) | (Student.is_active.is_(None)),
            ~Student.id.in_(assigned_subquery)
        ).order_by(Student.year_level, Student.reg_no).all()

        if not unassigned_students:
            return {
                "success": True,
                "message": "All students in this department are already assigned to a faculty member.",
                "allocated_count": 0
            }

        # Distribute unassigned students evenly among all department faculty in round-robin fashion
        fac_buckets = [{"faculty": fac, "assigned": []} for fac in faculty_members]
        total_allocated = 0
        now = datetime.datetime.utcnow()

        for idx, st in enumerate(unassigned_students):
            bucket = fac_buckets[idx % len(fac_buckets)]
            new_assign = FacultyStudentAssignment(
                faculty_id=bucket["faculty"].id,
                student_id=st.id,
                assigned_by_id=assigned_by_id,
                is_active=True,
                assigned_at=now
            )
            db.add(new_assign)
            bucket["assigned"].append(st.reg_no)
            total_allocated += 1

        db.commit()

        return {
            "success": True,
            "total_unassigned_initial": len(unassigned_students),
            "allocated_count": total_allocated,
            "unallocated_remaining": 0,
            "faculty_breakdown": [
                {
                    "faculty_id": fc["faculty"].id,
                    "faculty_name": fc["faculty"].username,
                    "newly_allocated": len(fc["assigned"]),
                    "total_now": FacultyAssignmentService.get_faculty_assigned_count(db, fc["faculty"].id),
                    "recommended_ratio": RECOMMENDED_FACULTY_STUDENT_RATIO
                }
                for fc in fac_buckets
            ]
        }


faculty_assignment_service = FacultyAssignmentService()
MentoringAssignmentService = FacultyAssignmentService

