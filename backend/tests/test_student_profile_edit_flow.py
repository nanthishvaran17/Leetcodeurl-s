import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.main import app
from backend.database import get_db, SessionLocal
from backend.models import Student, Department, User
from backend.seed import get_password_hash

client = TestClient(app)

def test_student_profile_edit_flow():
    db = SessionLocal()
    try:
        # Create test dept if needed
        dept = db.query(Department).filter(Department.code == "CSE-EDIT-TEST").first()
        if not dept:
            dept = Department(name="Computer Science Edit Test", code="CSE-EDIT-TEST")
            db.add(dept)
            db.commit()
            db.refresh(dept)

        # Fetch or create student
        student = db.query(Student).filter(Student.is_active == True).first()
        assert student is not None, "No active student found in database"

        # Create admin user for auth
        admin = db.query(User).filter(User.username == "admin_edit_tester").first()
        if not admin:
            admin = User(
                username="admin_edit_tester",
                email="admin_edit_tester@nandhaengg.org",
                hashed_password=get_password_hash("AdminPass123!"),
                role="admin",
                is_active=True
            )
            db.add(admin)
            db.commit()
            db.refresh(admin)

        # 1. Login to get token
        login_res = client.post("/api/auth/login", json={"username": admin.username, "password": "AdminPass123!"}, headers={"Origin": "http://localhost:3000"})
        assert login_res.status_code == 200, f"Login failed: {login_res.text}"
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}", "Origin": "http://localhost:3000"}

        # 2. Test GET student detail by integer ID
        res_id = client.get(f"/api/students/{student.id}", headers=headers)
        assert res_id.status_code == 200, f"GET by ID failed: {res_id.text}"
        assert res_id.json()["reg_no"] == student.reg_no

        # 3. Test GET student detail by string Register Number
        res_reg = client.get(f"/api/students/{student.reg_no}", headers=headers)
        assert res_reg.status_code == 200, f"GET by reg_no failed: {res_reg.text}"
        assert res_reg.json()["id"] == student.id

        orig_name = student.name
        # 4. Test PATCH student update by integer ID
        patch_payload_1 = {
            "name": orig_name,
            "reg_no": student.reg_no,
            "department_id": student.department_id,
            "year_level": "3",
            "section": "A"
        }
        res_patch_id = client.patch(f"/api/students/{student.id}", json=patch_payload_1, headers=headers)
        assert res_patch_id.status_code == 200, f"PATCH by ID failed: {res_patch_id.text}"

        # 5. Test PATCH student update by Register Number
        patch_payload_2 = {
            "name": orig_name,
            "reg_no": student.reg_no,
            "department_id": student.department_id,
            "year_level": "3",
            "section": "A"
        }
        res_patch_reg = client.patch(f"/api/students/{student.reg_no}", json=patch_payload_2, headers=headers)
        assert res_patch_reg.status_code == 200, f"PATCH by reg_no failed: {res_patch_reg.text}"
        assert res_patch_reg.json()["name"] == orig_name

        print("SUCCESS: Student Profile edit endpoints verified cleanly!")
    finally:
        db.close()

if __name__ == "__main__":
    test_student_profile_edit_flow()
