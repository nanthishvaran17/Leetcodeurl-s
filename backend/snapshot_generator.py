import datetime
import uuid
from sqlalchemy.orm import Session
from backend.models import Student, HODSnapshot

def generate_hod_snapshot(db: Session, title: str = None) -> HODSnapshot:
    """
    Generates a new HOD snapshot freezing the current verified state of all students.
    Never infers official participation from problem counts.
    Never fakes zero (only counts verified stats).
    """
    if not title:
        title = f"HOD Executive Snapshot - {datetime.date.today().strftime('%d %b %Y')}"
        
    snapshot_id = f"snap_{uuid.uuid4().hex[:8]}"
    
    # Calculate metrics
    students = db.query(Student).filter((Student.is_active == True) | (Student.is_active.is_(None))).all()
    
    total_students = len(students)
    synced_students = 0
    failed_sync = 0
    
    department_stats = {}
    
    total_solved_college = 0
    total_official_participations = 0
    total_virtual_participations = 0
    
    for student in students:
        dept_name = student.department.name if student.department else "Unknown"
        if dept_name not in department_stats:
            department_stats[dept_name] = {
                "total_students": 0,
                "synced_students": 0,
                "total_solved": 0,
                "official_participations": 0,
                "virtual_participations": 0,
                "students": []
            }
            
        department_stats[dept_name]["total_students"] += 1
        
        st = student.stats
        is_verified = st and st.validation_status == "verified"
        
        # NEVER Fake Zeros - if not verified, stats are considered unavailable for this snapshot
        s_data = {
            "reg_no": student.reg_no,
            "name": student.name,
            "verified": is_verified,
            "total_solved": st.total_solved if is_verified else None,
            "contest_rating": st.contest_rating if is_verified else None,
            "recent_contest_type": st.recent_contest_name if st else None
        }
        
        if is_verified:
            synced_students += 1
            department_stats[dept_name]["synced_students"] += 1
            solved = st.total_solved or 0
            total_solved_college += solved
            department_stats[dept_name]["total_solved"] += solved
            
            st.recent_contest_name if st else None
            # Here we need to check contest_participations for accurate counts
            
            # Simple heuristic for snapshot based on stats (since we want a quick summary)
            # A more robust way is to query ContestParticipation
            
        else:
            failed_sync += 1
            
        department_stats[dept_name]["students"].append(s_data)
        
    # Real query for participations
    from backend.models import ContestParticipation
    participations = db.query(ContestParticipation).all()
    for p in participations:
        if p.participation_type == "OFFICIAL":
            total_official_participations += 1
            # add to dept
            # (In a real system, you'd aggregate this efficiently with JOINs)
        elif p.participation_type == "VIRTUAL":
            total_virtual_participations += 1

    metrics = {
        "total_students": total_students,
        "synced_students": synced_students,
        "failed_sync": failed_sync,
        "total_solved_college": total_solved_college,
        "total_official_participations": total_official_participations,
        "total_virtual_participations": total_virtual_participations,
        "department_summary": {k: {
            "total_students": v["total_students"],
            "synced_students": v["synced_students"],
            "total_solved": v["total_solved"],
            "students": v["students"]  # Include the full student list for snapshot reporting
        } for k, v in department_stats.items()}
    }
    
    snapshot = HODSnapshot(
        snapshot_id=snapshot_id,
        title=title,
        metrics=metrics
    )
    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)
    
    return snapshot
