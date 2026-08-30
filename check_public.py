from backend.database import SessionLocal
from backend.models import WeeklyPublicResult, Student
db = SessionLocal()

public_res = db.query(WeeklyPublicResult).filter(
    WeeklyPublicResult.session_id == 2,
    WeeklyPublicResult.participation_status == 'PUBLIC'
).all()

for r in public_res:
    student = db.query(Student).filter(Student.id == r.student_id).first()
    uname = student.username if student else "N/A"
    print(f"Name: {r.name}, Username: {uname}, q1={r.q1}, q2={r.q2}, q3={r.q3}, q4={r.q4}, solved={r.total_contest_solved}, rank={r.contest_rank}")

db.close()
