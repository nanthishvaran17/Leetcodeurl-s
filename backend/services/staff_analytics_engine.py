from sqlalchemy.orm import Session
from sqlalchemy import func, desc, or_
from datetime import datetime, timedelta, timezone
from backend.models import Student, LeetCodeProfileStats, StaffAlert, WeeklyStudentProgress, ContestParticipation

class StaffAnalyticsEngine:
    @staticmethod
    def generate_at_risk_alerts(db: Session, staff_id: int, department_id: int = None):
        """
        Identifies students who haven't solved anything recently or missed contests
        and automatically creates StaffAlerts for them.
        """
        threshold_date = datetime.now(timezone.utc) - timedelta(days=14)
        
        query = db.query(Student).join(LeetCodeProfileStats).filter(
            Student.is_active == True,
            or_(
                LeetCodeProfileStats.recent_accepted == 0,
                LeetCodeProfileStats.active_days <= 1
            )
        )
        if department_id:
            query = query.filter(Student.department_id == department_id)
            
        at_risk_students = query.limit(50).all()
        
        new_alerts = 0
        for student in at_risk_students:
            # Check if alert already exists recently
            existing = db.query(StaffAlert).filter(
                StaffAlert.student_id == student.id,
                StaffAlert.alert_type == "AT_RISK",
                StaffAlert.is_read == False
            ).first()
            
            if not existing:
                alert = StaffAlert(
                    student_id=student.id,
                    staff_id=staff_id,
                    alert_type="AT_RISK",
                    severity="HIGH",
                    title=f"Inactivity Alert: {student.name}",
                    message=f"{student.name} ({student.reg_no}) has not been actively solving problems recently. Immediate follow-up recommended."
                )
                db.add(alert)
                new_alerts += 1
                
        db.commit()
        return new_alerts

    @staticmethod
    def detect_suspicious_activity(db: Session, staff_id: int):
        """
        Flags students who have solved an abnormal amount of hard questions in an impossible timeframe.
        (e.g., Cheating / Copy-pasting detector).
        """
        # We will flag students who have 0 easy, 0 medium, but > 10 hard (Unnatural pattern)
        suspicious = db.query(Student).join(LeetCodeProfileStats).filter(
            LeetCodeProfileStats.hard_solved > 10,
            LeetCodeProfileStats.easy_solved < 5
        ).all()
        
        flags = 0
        for student in suspicious:
            existing = db.query(StaffAlert).filter(
                StaffAlert.student_id == student.id,
                StaffAlert.alert_type == "SUSPICIOUS_ACTIVITY",
                StaffAlert.is_read == False
            ).first()
            
            if not existing:
                alert = StaffAlert(
                    student_id=student.id,
                    staff_id=staff_id,
                    alert_type="SUSPICIOUS_ACTIVITY",
                    severity="CRITICAL",
                    title=f"Plagiarism / Copying Suspect: {student.name}",
                    message=f"{student.name} has solved an unusually high number of Hard problems ({student.stats.hard_solved}) compared to Easy problems. Please verify their submissions manually."
                )
                db.add(alert)
                flags += 1
                
        db.commit()
        return flags

    @staticmethod
    def get_dashboard_summary(db: Session, staff_id: int):
        active_alerts = db.query(StaffAlert).filter(
            StaffAlert.staff_id == staff_id, 
            StaffAlert.is_read == False
        ).count()
        
        return {
            "active_alerts": active_alerts,
            "system_status": "MONITORING_ACTIVE"
        }
