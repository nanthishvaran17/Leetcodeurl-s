import sys
import os
sys.path.append('e:/Leetcode Web')
from backend.database import SessionLocal
from backend.models import Student, StudentStatSnapshot

db = SessionLocal()
student = db.query(Student).filter(Student.name.ilike('%nanthish%')).first()
if not student:
    print("Not found")
    sys.exit()

print(f"Student: {student.name}, ID: {student.id}")
snaps = db.query(StudentStatSnapshot).filter(StudentStatSnapshot.student_id == student.id).order_by(StudentStatSnapshot.captured_at.asc()).all()
for s in snaps:
    print(f"Snap at {s.captured_at}: Total {s.total_solved}")
