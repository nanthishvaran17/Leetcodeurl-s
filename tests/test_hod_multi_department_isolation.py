"""
tests/test_hod_multi_department_isolation.py — Verifies strict isolation for HODs with multiple allocated departments.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from backend.main import app
from backend.database import SessionLocal
from backend.models import User, Department, Student, HODDepartmentAllocation
from backend.routes.auth import create_access_token
from backend.services.authorization_service import get_hod_authorized_department_ids

client = TestClient(app)

def test_hod_multi_department_isolation():
    with SessionLocal() as db:
        # 1. Fetch or ensure 2 distinct departments
        cs_dept = db.query(Department).filter(Department.code == "CSE(CS)").first()
        iot_dept = db.query(Department).filter(Department.code == "CSE(IOT)").first()
        other_dept = db.query(Department).filter(Department.code.notin_(["CSE(CS)", "CSE(IOT)", "TEST"])).first()

        assert cs_dept is not None, "CSE(CS) department must exist in DB"
        assert iot_dept is not None, "CSE(IOT) department must exist in DB"
        assert other_dept is not None, "Another department (e.g. IT, ECE) must exist in DB"

        cs_dept_id = cs_dept.id
        iot_dept_id = iot_dept.id
        other_dept_id = other_dept.id
        other_dept_code = other_dept.code

        # 2. Create or find test HOD user
        hod_user = db.query(User).filter(User.username == "test_hod_multi_isolate").first()
        if not hod_user:
            hod_user = User(
                username="test_hod_multi_isolate",
                email="hod_multi_isolate@nandhaengg.org",
                role="hod",
                hashed_password="hashed_pw_test",
                is_active=True,
                department_id=cs_dept.id
            )
            db.add(hod_user)
            db.commit()
            db.refresh(hod_user)

        # Clear existing allocations and allocate exactly the 2 departments
        db.query(HODDepartmentAllocation).filter(HODDepartmentAllocation.user_id == hod_user.id).delete()
        alloc1 = HODDepartmentAllocation(user_id=hod_user.id, department_id=cs_dept.id)
        alloc2 = HODDepartmentAllocation(user_id=hod_user.id, department_id=iot_dept.id)
        db.add_all([alloc1, alloc2])
        db.commit()

        # Verify get_hod_authorized_department_ids returns exactly [cs_dept.id, iot_dept.id]
        auth_ids = get_hod_authorized_department_ids(db, hod_user)
        assert set(auth_ids) == {cs_dept.id, iot_dept.id}, f"Expected {[cs_dept.id, iot_dept.id]}, got {auth_ids}"

    # 3. Generate token for this HOD
    token = create_access_token(data={"sub": "test_hod_multi_isolate", "role": "hod", "user_id": hod_user.id})
    headers = {"Authorization": f"Bearer {token}"}

    # 4. Check /api/command-center/departments
    resp = client.get("/api/command-center/departments", headers=headers)
    assert resp.status_code == 200, resp.text
    dept_list = resp.json()
    dept_codes = [d["code"] for d in dept_list]
    assert "CSE(CS)" in dept_codes
    assert "CSE(IOT)" in dept_codes
    assert other_dept_code not in dept_codes, f"Unauthorized dept {other_dept_code} must not appear in HOD command center departments"

    # 5. Check /api/departments with all_depts=True
    resp = client.get("/api/departments?all_depts=true", headers=headers)
    assert resp.status_code == 200
    depts = resp.json()
    returned_codes = [d["code"] for d in depts]
    assert "CSE(CS)" in returned_codes
    assert "CSE(IOT)" in returned_codes
    assert other_dept_code not in returned_codes, f"Unauthorized dept {other_dept_code} must not appear in HOD departments endpoint"

    # 6. Check /api/command-center/summary with dept_id=None (ALL)
    resp = client.get("/api/command-center/summary", headers=headers)
    assert resp.status_code == 200, resp.text
    summary = resp.json()
    kpi = summary.get("kpi_summary", {})
    health = summary.get("department_health", {})
    benchmarks = summary.get("benchmarks", {})
    matrix = benchmarks.get("department_matrix", [])
    matrix_dept_ids = [m["department_id"] for m in matrix]
    for mid in matrix_dept_ids:
        assert mid in [cs_dept_id, iot_dept_id], f"Dept ID {mid} in benchmarks matrix is not authorized for HOD!"
    assert other_dept_id not in matrix_dept_ids

    # Verify that total_students across summary and students list is the exact sum of both departments (e.g. 150 + 150 = 300)
    cs_students = next((m["student_count"] for m in matrix if m["department_id"] == cs_dept_id), 0)
    iot_students = next((m["student_count"] for m in matrix if m["department_id"] == iot_dept_id), 0)
    expected_total = cs_students + iot_students
    assert kpi.get("total_students") == expected_total, f"Expected combined total {expected_total}, got {kpi.get('total_students')}"
    assert health.get("total_students") == expected_total, f"Expected health total {expected_total}, got {health.get('total_students')}"

    # Verify /api/command-center/students returns the exact combined total count
    resp_st = client.get("/api/command-center/students?include_inactive=false", headers=headers)
    assert resp_st.status_code == 200
    st_data = resp_st.json()
    assert st_data.get("total") == expected_total, f"Expected students total {expected_total}, got {st_data.get('total')}"

    # 7. Check /api/command-center/summary with dept_id=cs_dept_id
    resp = client.get(f"/api/command-center/summary?dept_id={cs_dept_id}", headers=headers)
    assert resp.status_code == 200
    summary_cs = resp.json()
    matrix_cs = summary_cs.get("benchmarks", {}).get("department_matrix", [])
    for m in matrix_cs:
        assert m["department_id"] == cs_dept_id

    # 8. Check passing unauthorized dept_id (other_dept_id)
    resp = client.get(f"/api/command-center/summary?dept_id={other_dept_id}", headers=headers)
    assert resp.status_code == 200
    summary_other = resp.json()
    matrix_clamped = summary_other.get("benchmarks", {}).get("department_matrix", [])
    for m in matrix_clamped:
        assert m["department_id"] in [cs_dept_id, iot_dept_id], "Unauthorized dept_id must be clamped to authorized depts"

    # Clean up test user
    with SessionLocal() as db:
        db.query(HODDepartmentAllocation).filter(HODDepartmentAllocation.user_id == hod_user.id).delete()
        db.query(User).filter(User.id == hod_user.id).delete()
        db.commit()

    print("\n[ALL HOD MULTI-DEPARTMENT ISOLATION TESTS PASSED 100%]")
