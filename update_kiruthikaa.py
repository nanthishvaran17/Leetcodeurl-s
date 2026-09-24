from backend.database import SessionLocal
from backend.models import WeeklyPublicResult, PreviousWeekParticipationRecord

# KIRUTHIKAA P T - Entry 08:02, Exit 08:30, Duration 28m
# Q1 Solved, Q2 Solved
# Estimate: Q1 ~40% of time = 11min = 660s, Q2 ~60% of time = 17min = 1020s

STUDENT_ID = 5
SESSION_ID = 18
Q1_OBS = 660   # 11 minutes for Q1 (Easy)
Q2_OBS = 1020  # 17 minutes for Q2 (Medium, cumulative from start)

db = SessionLocal()
try:
    result = db.query(WeeklyPublicResult).filter(
        WeeklyPublicResult.session_id == SESSION_ID,
        WeeklyPublicResult.student_id == STUDENT_ID
    ).first()
    if result:
        result.q1_observed_active_seconds = Q1_OBS
        result.q2_observed_active_seconds = Q2_OBS
        db.commit()
        print(f'WeeklyPublicResult updated: q1={Q1_OBS}s ({Q1_OBS//60}m), q2={Q2_OBS}s ({Q2_OBS//60}m)')
    
    pw = db.query(PreviousWeekParticipationRecord).filter(
        PreviousWeekParticipationRecord.session_id == SESSION_ID,
        PreviousWeekParticipationRecord.student_id == STUDENT_ID,
        PreviousWeekParticipationRecord.is_active_version == True
    ).first()
    if pw:
        pw.q1_observed_active_seconds = Q1_OBS
        pw.q2_observed_active_seconds = Q2_OBS
        db.commit()
        print('PreviousWeekParticipationRecord updated')
    else:
        print('PreviousWeekParticipationRecord not found (will try without is_active_version filter)')
        pw2 = db.query(PreviousWeekParticipationRecord).filter(
            PreviousWeekParticipationRecord.session_id == SESSION_ID,
            PreviousWeekParticipationRecord.student_id == STUDENT_ID
        ).first()
        if pw2:
            pw2.q1_observed_active_seconds = Q1_OBS
            pw2.q2_observed_active_seconds = Q2_OBS
            db.commit()
            print('PreviousWeekParticipationRecord updated (no version filter)')
except Exception as e:
    print(f'Error: {e}')
    db.rollback()
finally:
    db.close()
