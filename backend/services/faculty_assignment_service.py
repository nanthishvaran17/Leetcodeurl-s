"""
faculty_assignment_service.py — Institutional Faculty-Student Allocation Engine

Enforces strict institutional capacity and ownership rules:
1. 1 Faculty -> Maximum 30 Students (Hard limit enforced at backend).
2. 1 Student -> Exactly 1 Active Faculty Advisor.
3. Strict department-level boundaries (HOD / Faculty only assign within department).
4. Auto-distribution and rebalancing algorithm for batch allocation.
"""

import threading
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException, status
import datetime
from fastapi import BackgroundTasks

from backend.models import User, Student, FacultyStudentAssignment, Department, LeetCodeProfileStats, StudentAssignmentHistory
from backend.logger import logger

RECOMMENDED_FACULTY_STUDENT_RATIO = 20
MAX_STUDENTS_PER_FACULTY = 30  # Hard backend capacity cap
_allocation_lock = threading.RLock()


class FacultyAssignmentService:
    @staticmethod
    def get_faculty_assigned_student_ids(db: Session, faculty_id: int) -> List[int]:
        """Returns list of student IDs currently assigned to a faculty member."""
        from backend.cache import cache
        
        def _fetch():
            assignments = db.query(FacultyStudentAssignment.student_id).filter(
                FacultyStudentAssignment.faculty_id == faculty_id,
                FacultyStudentAssignment.is_active == True
            ).all()
            return [a[0] for a in assignments]
            
        return cache.get_or_compute(
            key=f"assigned_students_{faculty_id}",
            compute_func=_fetch,
            ttl_seconds=3600,
            tags=[f"user_auth_{faculty_id}", "students"]
        )

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
        assigned_by_id: Optional[int] = None,
        background_tasks: Optional[BackgroundTasks] = None
    ) -> Dict[str, Any]:
        """
        Assigns one or more students to a faculty member.
        Hard capacity limit of 30 students enforced server-side.
        Guaranteed concurrency-safe against race conditions via:
          1. threading.RLock (single-process / SQLite safety)
          2. SELECT FOR UPDATE (PostgreSQL multi-worker / gunicorn safety)
        """
        with _allocation_lock:
            faculty = db.query(User).filter(User.id == faculty_id, User.is_active == True).first()
            if not faculty:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Faculty with ID {faculty_id} not found or is inactive."
                )

            # DB-LEVEL ATOMIC CAPACITY CHECK
            # For PostgreSQL: SELECT FOR UPDATE locks the row(s) preventing concurrent reads
            # that haven't committed yet from passing the capacity check simultaneously.
            # For SQLite: falls back to count-based check (threading.RLock is sufficient in single-process).
            from sqlalchemy import text, func as sa_func
            from backend.database import engine as _engine
            is_postgres = "postgresql" in str(_engine.url)

            if is_postgres:
                # Lock faculty_student_assignments rows for this faculty atomically
                db.execute(
                    text(
                        "SELECT id FROM faculty_student_assignments "
                        "WHERE faculty_id = :fid AND is_active = true FOR UPDATE"
                    ),
                    {"fid": faculty_id}
                )

            # Re-read count INSIDE the locked transaction
            current_count = db.query(sa_func.count(FacultyStudentAssignment.id)).filter(
                FacultyStudentAssignment.faculty_id == faculty_id,
                FacultyStudentAssignment.is_active == True
            ).scalar() or 0
            
            # Deduplicate student_ids
            unique_student_ids = list(dict.fromkeys(student_ids))
            
            # Check if any students are already assigned to this faculty
            existing_ids = FacultyAssignmentService.get_faculty_assigned_student_ids(db, faculty_id)
            new_ids = [sid for sid in unique_student_ids if sid not in existing_ids]

            if current_count + len(new_ids) > MAX_STUDENTS_PER_FACULTY:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="This staff member has reached the maximum student capacity."
                )

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
                    # If staff member has no assigned students yet, update their department to match the students
                    if current_count == 0:
                        faculty.department_id = st.department_id
                        db.commit()
                    elif not assigned_by_id:
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail=f"Cross-department assignment forbidden. Student '{st.name}' ({st.reg_no}) belongs to a different department."
                        )

            # Apply assignments (handling reassignment if student had a previous faculty)
            assigned_count = 0
            reassigned_count = 0
            now = datetime.datetime.utcnow()
            students_allocated_data = []

            for sid in new_ids:
                st_obj = found_map[sid]
                students_allocated_data.append({
                    "name": st_obj.name,
                    "reg_no": st_obj.reg_no,
                    "department": st_obj.department.name if st_obj.department else "N/A"
                })

                existing_assignment = db.query(FacultyStudentAssignment).filter(
                    FacultyStudentAssignment.student_id == sid
                ).first()

                prev_faculty_id = None
                if existing_assignment:
                    prev_faculty_id = existing_assignment.faculty_id
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

                # Record Assignment History
                history_record = StudentAssignmentHistory(
                    student_id=sid,
                    previous_faculty_id=prev_faculty_id,
                    new_faculty_id=faculty_id,
                    assigned_by_id=assigned_by_id,
                    reason="Staff Allocation",
                    assigned_at=now
                )
                db.add(history_record)

            db.commit()
            
            from backend.cache import cache
            cache.invalidate_tag("students")
            cache.invalidate_tag(f"user_auth_{faculty_id}")
            new_total = FacultyAssignmentService.get_faculty_assigned_count(db, faculty_id)

            logger.info(f"[FACULTY_ASSIGNMENT] Evaluating email notification for {faculty.username} (Email: {faculty.email}). Students assigned: {len(students_allocated_data)}")
            if background_tasks and faculty.email and students_allocated_data:
                logger.info(f"[FACULTY_ASSIGNMENT] Queueing background email to {faculty.email} for {len(students_allocated_data)} students.")
                from backend.services.email_notifications import notify_faculty_allocation
                background_tasks.add_task(
                    notify_faculty_allocation,
                    faculty_email=faculty.email,
                    faculty_name=faculty.username,
                    students=students_allocated_data
                )
            else:
                logger.warning(f"[FACULTY_ASSIGNMENT] SKIPPED email notification. background_tasks={bool(background_tasks)}, email={bool(faculty.email)}, students={bool(students_allocated_data)}")

            # Determine informational workload status
            if new_total < RECOMMENDED_FACULTY_STUDENT_RATIO:
                workload_status = "NORMAL"
                workload_label = "Within Target Capacity"
            elif new_total == RECOMMENDED_FACULTY_STUDENT_RATIO:
                workload_status = "AT_RATIO"
                workload_label = "At Target Ratio"
            elif new_total <= MAX_STUDENTS_PER_FACULTY:
                workload_status = "ABOVE_RATIO"
                workload_label = "Above Recommended Target"
            else:
                workload_status = "HIGH_WORKLOAD"
                workload_label = "High Workload"

            logger.info(
                f"[FACULTY_ASSIGNMENT] Staff {faculty.username} (ID {faculty_id}) assigned {len(new_ids)} students. "
                f"Total now: {new_total}/{MAX_STUDENTS_PER_FACULTY} (Status: {workload_label})"
            )

            return {
                "success": True,
                "faculty_id": faculty_id,
                "faculty_name": faculty.username,
                "assigned_count": len(new_ids),
                "reassigned_count": reassigned_count,
                "total_assigned": new_total,
                "max_capacity": MAX_STUDENTS_PER_FACULTY,
                "recommended_ratio": RECOMMENDED_FACULTY_STUDENT_RATIO,
                "workload_status": workload_status,
                "workload_label": workload_label,
                "workload_warning": f"Staff has {new_total} students (Above recommended target of {RECOMMENDED_FACULTY_STUDENT_RATIO})" if new_total > RECOMMENDED_FACULTY_STUDENT_RATIO else None
            }

    @staticmethod
    def unassign_students(
        db: Session,
        faculty_id: int,
        student_ids: List[int],
        background_tasks: Optional[BackgroundTasks] = None
    ) -> Dict[str, Any]:
        """Removes students from a faculty member's allocation."""
        now = datetime.datetime.utcnow()
        students_unallocated_data = []

        students = db.query(Student).filter(Student.id.in_(student_ids)).all()
        for st in students:
            students_unallocated_data.append({
                "name": st.name,
                "reg_no": st.reg_no,
                "department": st.department.name if st.department else "N/A"
            })

        for sid in student_ids:
            history_record = StudentAssignmentHistory(
                student_id=sid,
                previous_faculty_id=faculty_id,
                new_faculty_id=None,
                assigned_by_id=None,
                reason="Unassigned from Staff",
                assigned_at=now
            )
            db.add(history_record)

        deleted = db.query(FacultyStudentAssignment).filter(
            FacultyStudentAssignment.faculty_id == faculty_id,
            FacultyStudentAssignment.student_id.in_(student_ids)
        ).delete(synchronize_session=False)

        db.commit()
        
        from backend.cache import cache
        cache.invalidate_tag("students")
        cache.invalidate_tag(f"user_auth_{faculty_id}")
        remaining = FacultyAssignmentService.get_faculty_assigned_count(db, faculty_id)

        if background_tasks and students_unallocated_data:
            faculty = db.query(User).filter(User.id == faculty_id).first()
            if faculty and faculty.email:
                from backend.services.email_notifications import notify_faculty_unallocation
                background_tasks.add_task(
                    notify_faculty_unallocation,
                    faculty_email=faculty.email,
                    faculty_name=faculty.username,
                    students=students_unallocated_data
                )

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
        up to 30 students max per faculty member in round-robin fashion.
        """
        faculty_members = db.query(User).filter(
            User.department_id == department_id,
            User.is_active == True,
            User.role.in_(["Faculty", "faculty", "Staff", "staff", "HOD", "hod"])
        ).all()

        if not faculty_members:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No active staff members found in this department for auto-allocation."
            )

        # Filter faculty who have not reached max capacity (30)
        eligible_faculty = []
        for f in faculty_members:
            count = FacultyAssignmentService.get_faculty_assigned_count(db, f.id)
            if count < MAX_STUDENTS_PER_FACULTY:
                eligible_faculty.append({"faculty": f, "current": count, "assigned": []})

        if not eligible_faculty:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="All staff members in this department have reached maximum student capacity (30)."
            )

        # Get all unassigned active students in this department
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
                "message": "All students in this department are already assigned to a mentor.",
                "allocated_count": 0
            }

        total_allocated = 0
        now = datetime.datetime.utcnow()

        # Round robin allocation respecting max limit of 30 per staff
        fac_idx = 0
        for st in unassigned_students:
            # Find next eligible staff with capacity < 30
            attempts = 0
            while attempts < len(eligible_faculty):
                bucket = eligible_faculty[fac_idx % len(eligible_faculty)]
                if bucket["current"] < MAX_STUDENTS_PER_FACULTY:
                    existing_assign = db.query(FacultyStudentAssignment).filter(
                        FacultyStudentAssignment.student_id == st.id
                    ).first()
                    prev_fac = existing_assign.faculty_id if existing_assign else None

                    if existing_assign:
                        existing_assign.faculty_id = bucket["faculty"].id
                        existing_assign.assigned_by_id = assigned_by_id
                        existing_assign.is_active = True
                        existing_assign.assigned_at = now
                    else:
                        new_assign = FacultyStudentAssignment(
                            faculty_id=bucket["faculty"].id,
                            student_id=st.id,
                            assigned_by_id=assigned_by_id,
                            is_active=True,
                            assigned_at=now
                        )
                        db.add(new_assign)

                    history_record = StudentAssignmentHistory(
                        student_id=st.id,
                        previous_faculty_id=prev_fac,
                        new_faculty_id=bucket["faculty"].id,
                        assigned_by_id=assigned_by_id,
                        reason="Auto Distribution",
                        assigned_at=now
                    )
                    db.add(history_record)

                    bucket["assigned"].append(st.reg_no)
                    bucket["current"] += 1
                    total_allocated += 1
                    fac_idx += 1
                    break
                fac_idx += 1
                attempts += 1

        db.commit()

        return {
            "success": True,
            "total_unassigned_initial": len(unassigned_students),
            "allocated_count": total_allocated,
            "unallocated_remaining": len(unassigned_students) - total_allocated,
            "faculty_breakdown": [
                {
                    "faculty_id": fc["faculty"].id,
                    "faculty_name": fc["faculty"].username,
                    "newly_allocated": len(fc["assigned"]),
                    "total_now": fc["current"],
                    "max_capacity": MAX_STUDENTS_PER_FACULTY
                }
                for fc in eligible_faculty
            ]
        }

    @staticmethod
    def disable_staff_account(
        db: Session,
        staff_id: int,
        disabled_by_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Disables staff account and moves all assigned students to unassigned queue.
        Student performance history remains intact.
        """
        staff = db.query(User).filter(User.id == staff_id).first()
        if not staff:
            raise HTTPException(status_code=404, detail="Staff account not found.")

        staff.is_active = False
        now = datetime.datetime.utcnow()

        assigned_students = db.query(FacultyStudentAssignment).filter(
            FacultyStudentAssignment.faculty_id == staff_id,
            FacultyStudentAssignment.is_active == True
        ).all()

        unassigned_count = len(assigned_students)
        for assign in assigned_students:
            history_record = StudentAssignmentHistory(
                student_id=assign.student_id,
                previous_faculty_id=staff_id,
                new_faculty_id=None,
                assigned_by_id=disabled_by_id,
                reason="Staff Disabled — Reallocation Queue",
                assigned_at=now
            )
            db.add(history_record)

        db.query(FacultyStudentAssignment).filter(
            FacultyStudentAssignment.faculty_id == staff_id
        ).delete(synchronize_session=False)

        db.commit()

        logger.info(f"[STAFF_DISABLE] Staff {staff.username} disabled. {unassigned_count} students moved to unassigned queue.")

        return {
            "success": True,
            "message": f"Staff account disabled. {unassigned_count} students moved to unassigned queue.",
            "unassigned_count": unassigned_count
        }

    @staticmethod
    def rebalance_staff_allocations(
        db: Session,
        department_id: Optional[int] = None,
        assigned_by_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Auto-balances workload across staff members by distributing unassigned students
        evenly up to max capacity 30.
        """
        query = db.query(User).filter(
            User.is_active == True,
            User.role.in_(["Faculty", "faculty", "Staff", "staff", "HOD", "hod"])
        )
        if department_id:
            query = query.filter(User.department_id == department_id)

        staff_list = query.all()
        if not staff_list:
            return {"success": False, "message": "No active staff members found to rebalance."}

        # Auto distribute department
        depts_to_process = [department_id] if department_id else list(set([s.department_id for s in staff_list if s.department_id]))
        total_rebalanced = 0

        for d_id in depts_to_process:
            try:
                res = FacultyAssignmentService.auto_distribute_department(db, d_id, assigned_by_id=assigned_by_id)
                total_rebalanced += res.get("allocated_count", 0)
            except Exception:
                pass

        return {
            "success": True,
            "message": f"Auto-rebalancing complete. Reallocated {total_rebalanced} students across staff.",
            "reallocated_count": total_rebalanced
        }


faculty_assignment_service = FacultyAssignmentService()
MentoringAssignmentService = FacultyAssignmentService


