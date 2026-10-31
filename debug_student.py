import sys
sys.path.append('.')
from backend.database import SessionLocal
from backend.models import Student, LeetCodeProfileStats, StudentStatSnapshot, LeetCodeActivity, LeetCodeContestRatingHistory, StudentContestSnapshot
import json

db = SessionLocal()
student = db.query(Student).filter(Student.reg_no.ilike('%732224CI044%')).first()
if not student:
    print('Student not found by reg_no, trying by name...')
    student = db.query(Student).filter(Student.name.ilike('%RITHANYA%')).first()

if student:
    print(f'Student: id={student.id}, name={student.name}, reg_no={student.reg_no}, username={student.username}')
    stats = db.query(LeetCodeProfileStats).filter(LeetCodeProfileStats.student_id == student.id).first()
    if stats:
        print(f'Stats: total_solved={stats.total_solved}, easy={stats.easy_solved}, med={stats.medium_solved}, hard={stats.hard_solved}, rating={stats.contest_rating}')
    else:
        print('No stats')
    
    snaps = db.query(StudentStatSnapshot).filter(StudentStatSnapshot.student_id == student.id).order_by(StudentStatSnapshot.captured_at.asc()).all()
    print(f'StudentStatSnapshots count: {len(snaps)}')
    for s in snaps:
        print(f'  Snap: captured={s.captured_at}, solved={s.total_solved}, delta={s.delta_total}')
        
    act = db.query(LeetCodeActivity).filter(LeetCodeActivity.student_id == student.id).first()
    if act:
        print(f'Activity found!')
        try:
            cal = json.loads(act.submission_calendar or '{}')
            print(f'  Calendar entries count: {len(cal)}')
            # convert some timestamps to dates
            import datetime
            sorted_cal = sorted([(int(k), v) for k, v in cal.items()])
            for ts, count in sorted_cal[-10:]:
                dt = datetime.datetime.fromtimestamp(ts, tz=datetime.timezone.utc).strftime('%Y-%m-%d')
                print(f'    Date: {dt} (ts={ts}): {count} submissions')
        except Exception as e:
            print(f'  Calendar error: {e}')
    else:
        print('No LeetCodeActivity row')

    contests = db.query(LeetCodeContestRatingHistory).filter(LeetCodeContestRatingHistory.student_id == student.id).all()
    print(f'Contests (LeetCodeContestRatingHistory) count: {len(contests)}')

    c_snaps = db.query(StudentContestSnapshot).filter(StudentContestSnapshot.student_id == student.id).all()
    print(f'Contest Snapshots count: {len(c_snaps)}')
else:
    print('Student not found')
db.close()
