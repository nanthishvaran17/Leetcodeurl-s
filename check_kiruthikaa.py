from backend.database import engine, SessionLocal
from backend.models import WeeklyPublicResult, PreviousWeekParticipationRecord, Student

db = SessionLocal()
try:
    # Find KIRUTHIKAA's student record
    student = db.query(Student).filter(Student.reg_no == '732224CC021').first()
    if not student:
        print('Student not found')
    else:
        print(f'Student: {student.name}, ID: {student.id}, Username: {student.username}')
        
        # Find their WeeklyPublicResult for contest 520
        from backend.models import WeeklySession
        session = db.query(WeeklySession).filter(WeeklySession.contest_id.ilike('%520%')).first()
        if session:
            print(f'Session: {session.id} - {session.contest_id}')
            result = db.query(WeeklyPublicResult).filter(
                WeeklyPublicResult.session_id == session.id,
                WeeklyPublicResult.student_id == student.id
            ).first()
            if result:
                print(f'Result: q1={result.q1}, q2={result.q2}, q3={result.q3}, q4={result.q4}')
                print(f'q1_observed={getattr(result, "q1_observed_active_seconds", "N/A")}')
            else:
                print('Result not found in WeeklyPublicResult')
        else:
            print('Session 520 not found')
finally:
    db.close()
