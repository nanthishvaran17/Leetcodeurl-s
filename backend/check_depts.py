from backend.database import SessionLocal
from backend.models import Department, Student

db = SessionLocal()
departments = db.query(Department).all()
print("Departments:")
for d in departments:
    print(f"ID: {d.id}, Code: {d.code}, Name: {d.name}")

cs_iot_students = db.query(Student).join(Department).filter(Department.code.in_(['CSE(CS)', 'CSE(IoT)', 'CSE(IOT)'])).count()
total_students = db.query(Student).count()
print(f"\nTotal students: {total_students}")
print(f"CS/IoT students: {cs_iot_students}")
