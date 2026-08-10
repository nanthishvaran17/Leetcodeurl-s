from typing import List, Dict, Any
from sqlalchemy.orm import Session
from backend.models import WeeklySessionSnapshot, Student
from backend.logger import logger

ANOMALY_SOLVED_THRESHOLD = 25  # Unusually high solved count jump in 1.5 hr session

def detect_session_anomalies(db: Session, session_id: int) -> List[Dict[str, Any]]:
    """
    Scans weekly session snapshots for suspicious activity (e.g. +25 solved in 90 minutes).
    """
    snapshots = db.query(WeeklySessionSnapshot).filter(WeeklySessionSnapshot.session_id == session_id).all()
    anomalies = []

    for sn in snapshots:
        if sn.problems_added >= ANOMALY_SOLVED_THRESHOLD:
            student = db.query(Student).filter(Student.id == sn.student_id).first()
            anomalies.append({
                "student_id": sn.student_id,
                "reg_no": student.reg_no if student else "N/A",
                "student_name": student.name if student else "N/A",
                "problems_added": sn.problems_added,
                "start_solved": sn.start_solved_count,
                "end_solved": sn.end_solved_count,
                "issue": f"Implausible jump of +{sn.problems_added} solved problems in a single 90-minute session."
            })
            logger.warning(f"ANOMALY DETECTED: Student {student.reg_no} ({student.name}) +{sn.problems_added} solved!")

    return anomalies
