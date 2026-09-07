import asyncio
import datetime
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import Dict, Any, List
from backend.models import Student, WeeklyVerificationRecord
from backend.logger import logger
from backend.leetcode_tracker import fetch_leetcode_contest_and_submissions
from backend.services.token_bucket_limiter import global_token_bucket_limiter

async def fetch_student_weekly_solved(leetcode_id: str) -> int:
    try:
        await global_token_bucket_limiter.acquire()
        # Mock logic or real logic to get weekly activity.
        # We will use the existing fetch_leetcode_contest_and_submissions and extract solved_count.
        data = await fetch_leetcode_contest_and_submissions(leetcode_id)
        # Using total solved here as a stand-in for 'weekly solved' 
        # based on existing logic.
        stats = data.get("matchedUser", {}).get("submitStats", {}).get("acSubmissionNum", [])
        if not stats:
            return 0
        return stats[0].get("count", 0)
    except Exception as e:
        logger.error(f"Failed to fetch stats for {leetcode_id}: {e}")
        return -1 # -1 denotes fetch failure (COULD_NOT_VERIFY)

async def verify_dual_leetcode_accounts(
    student: Student, 
    verification_week: int, 
    notification_type: str, 
    db: Session
) -> Dict[str, Any]:
    
    primary_solved = 0
    secondary_solved = 0
    status = "VALID"
    
    primary_id = student.primary_leetcode_id or student.username
    if primary_id:
        p_solved = await fetch_student_weekly_solved(primary_id)
        if p_solved < 0:
            status = "COULD_NOT_VERIFY"
        else:
            primary_solved = p_solved

    if student.secondary_leetcode_id and student.secondary_status == "approved":
        s_solved = await fetch_student_weekly_solved(student.secondary_leetcode_id)
        if s_solved < 0:
            status = "COULD_NOT_VERIFY"
        else:
            secondary_solved = s_solved
            
    if status != "COULD_NOT_VERIFY":
        if primary_solved > 0 or secondary_solved > 0:
            status = "VALID"
        else:
            status = "INVALID"
            
    # Idempotent Record Creation
    record = db.query(WeeklyVerificationRecord).filter(
        WeeklyVerificationRecord.student_id == student.id,
        WeeklyVerificationRecord.verification_week == verification_week,
        WeeklyVerificationRecord.notification_type == notification_type
    ).first()
    
    if not record:
        record = WeeklyVerificationRecord(
            student_id=student.id,
            verification_week=verification_week,
            notification_type=notification_type,
            primary_solved=primary_solved,
            secondary_solved=secondary_solved,
            status=status,
            email_dispatched=False
        )
        db.add(record)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            record = db.query(WeeklyVerificationRecord).filter(
                WeeklyVerificationRecord.student_id == student.id,
                WeeklyVerificationRecord.verification_week == verification_week,
                WeeklyVerificationRecord.notification_type == notification_type
            ).first()
    else:
        record.primary_solved = primary_solved
        record.secondary_solved = secondary_solved
        record.status = status
        db.commit()
        
    return {
        "student_id": student.id,
        "primary_solved": primary_solved,
        "secondary_solved": secondary_solved,
        "status": status,
        "email_dispatched": record.email_dispatched
    }

async def dispatch_weekly_verification_emails(
    verification_week: int, 
    notification_type: str, 
    db: Session
):
    students = db.query(Student).filter(Student.is_active == True).all()
    tasks = [verify_dual_leetcode_accounts(s, verification_week, notification_type, db) for s in students]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    emails_sent = 0
    for res in results:
        if isinstance(res, Exception):
            logger.error(f"Error in verification task: {res}")
            continue
            
        if res["status"] == "INVALID" and not res["email_dispatched"]:
            # Mock sending email
            logger.info(f"Sending non-attendance email to student_id {res['student_id']}")
            record = db.query(WeeklyVerificationRecord).filter(
                WeeklyVerificationRecord.student_id == res["student_id"],
                WeeklyVerificationRecord.verification_week == verification_week,
                WeeklyVerificationRecord.notification_type == notification_type
            ).first()
            if record:
                record.email_dispatched = True
                db.commit()
                emails_sent += 1
                
    return emails_sent
