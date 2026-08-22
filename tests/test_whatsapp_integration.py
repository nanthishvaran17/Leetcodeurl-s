"""
tests/test_whatsapp_integration.py — Complete Verification Suite for Secure WhatsApp Integration Layer

Verifies:
1. Linking & Normalization of E.164 WhatsApp numbers to existing User & Student records.
2. Principal / Super Admin Institutional Scope (Full Institution, All Depts, Cross-dept search).
3. HOD Department Scope (Own Dept only, Cross-Dept queries strictly BLOCKED / 403).
4. Faculty Mentee Scope (Assigned Mentees only, Unassigned student queries strictly BLOCKED / 403).
5. Student Self Scope (Own Profile only, Mentor commands & Cross-student search BLOCKED / 403).
6. Unregistered Phone Number Onboarding Fallback.
7. Webhook Handshake & Inbound Message Processing (Meta JSON + Twilio Form formats).
"""

import os
import sys
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import SessionLocal, run_migrations
from backend.main import app
from backend.models import User, Student, Department, FacultyStudentAssignment, LeetCodeProfileStats
from backend.services.whatsapp_auth_service import whatsapp_auth_service, WhatsAppIdentity
from backend.services.whatsapp_query_engine import whatsapp_query_engine
from backend.services.whatsapp_agent_service import whatsapp_agent_service
from backend.routes.auth import create_access_token

client = TestClient(app)


def setup_test_entities(db):
    """Sets up verified test users and students for all 4 roles."""
    # 1. Run migrations to ensure columns exist
    run_migrations()

    # 2. Get or create departments
    dept_cse = db.query(Department).filter(Department.code == "CSE").first()
    if not dept_cse:
        dept_cse = Department(name="Computer Science and Engineering", code="CSE")
        db.add(dept_cse)
        db.commit()

    dept_it = db.query(Department).filter(Department.code == "IT").first()
    if not dept_it:
        dept_it = Department(name="Information Technology", code="IT")
        db.add(dept_it)
        db.commit()

    # 3. Principal User
    principal = db.query(User).filter(User.username == "test_principal_wa").first()
    if not principal:
        principal = User(
            username="test_principal_wa",
            email="principal_wa@nandhaengg.org",
            hashed_password="mock_password",
            role="Super Admin",
            department_id=dept_cse.id,
            is_active=True
        )
        db.add(principal)
        db.commit()
    whatsapp_auth_service.link_phone_number(db, "USER", principal.id, "+919876500001")

    # 4. HOD User (CSE)
    hod_cse = db.query(User).filter(User.username == "test_hod_cse_wa").first()
    if not hod_cse:
        hod_cse = User(
            username="test_hod_cse_wa",
            email="hod_cse_wa@nandhaengg.org",
            hashed_password="mock_password",
            role="HOD",
            department_id=dept_cse.id,
            is_active=True
        )
        db.add(hod_cse)
        db.commit()
    whatsapp_auth_service.link_phone_number(db, "USER", hod_cse.id, "+919876500002")

    # 5. Faculty User (CSE)
    faculty_cse = db.query(User).filter(User.username == "test_faculty_cse_wa").first()
    if not faculty_cse:
        faculty_cse = User(
            username="test_faculty_cse_wa",
            email="faculty_cse_wa@nandhaengg.org",
            hashed_password="mock_password",
            role="Faculty",
            department_id=dept_cse.id,
            is_active=True
        )
        db.add(faculty_cse)
        db.commit()
    whatsapp_auth_service.link_phone_number(db, "USER", faculty_cse.id, "+919876500003")

    # 6. Student A (CSE) - Assigned to Faculty
    student_cse = db.query(Student).filter(Student.reg_no == "WA_CSE_001").first()
    if not student_cse:
        student_cse = Student(
            reg_no="WA_CSE_001",
            name="Kavitha R",
            department_id=dept_cse.id,
            year_level="III",
            username="kavitha_wa",
            is_active=True
        )
        db.add(student_cse)
        db.commit()
        # Add stats
        stats = LeetCodeProfileStats(
            student_id=student_cse.id,
            total_solved=142,
            easy_solved=60,
            medium_solved=70,
            hard_solved=12,
            max_streak=21,
            contest_rating=1620.5
        )
        db.add(stats)
        db.commit()
    whatsapp_auth_service.link_phone_number(db, "STUDENT", student_cse.id, "+919876500004")

    # Assign student_cse to faculty_cse
    assign = db.query(FacultyStudentAssignment).filter(
        FacultyStudentAssignment.student_id == student_cse.id
    ).first()
    if not assign:
        assign = FacultyStudentAssignment(
            faculty_id=faculty_cse.id,
            student_id=student_cse.id,
            is_active=True
        )
        db.add(assign)
        db.commit()

    # 7. Student B (IT) - Unassigned to faculty_cse
    student_it = db.query(Student).filter(Student.reg_no == "WA_IT_002").first()
    if not student_it:
        student_it = Student(
            reg_no="WA_IT_002",
            name="Siddharth M",
            department_id=dept_it.id,
            year_level="IV",
            username="siddharth_wa",
            is_active=True
        )
        db.add(student_it)
        db.commit()
        stats_it = LeetCodeProfileStats(
            student_id=student_it.id,
            total_solved=95,
            easy_solved=40,
            medium_solved=50,
            hard_solved=5,
            max_streak=7,
            contest_rating=1510.0
        )
        db.add(stats_it)
        db.commit()
    whatsapp_auth_service.link_phone_number(db, "STUDENT", student_it.id, "+919876500005")

    return {
        "principal": principal,
        "hod_cse": hod_cse,
        "faculty_cse": faculty_cse,
        "student_cse": student_cse,
        "student_it": student_it
    }


def run_whatsapp_integration_suite():
    print("=" * 80)
    print("NANDHA LEETCODE INTELLIGENCE — SECURE WHATSAPP INTEGRATION TEST SUITE")
    print("=" * 80)

    with SessionLocal() as db:
        entities = setup_test_entities(db)

        # ---------------------------------------------------------------------
        # TEST 1: PHONE NORMALIZATION & IDENTITY RESOLUTION
        # ---------------------------------------------------------------------
        print("\n--- [TEST 1] PHONE NORMALIZATION & IDENTITY RESOLUTION ---")
        
        # Test various input formats for the same number
        formats = [
            "whatsapp:+919876500001",
            "+91 98765 00001",
            "09876500001",
            "9876500001",
            "+91-98765-00001"
        ]
        for f in formats:
            id_resolved = whatsapp_auth_service.resolve_identity(db, f)
            assert id_resolved.role == "PRINCIPAL", f"Failed for format {f}: got {id_resolved.role}"
            assert id_resolved.phone_number == "+919876500001"
        print("  + Phone number normalization (E.164) verified across 5 formats.")

        # Resolve all 4 roles + unregistered
        id_principal = whatsapp_auth_service.resolve_identity(db, "+919876500001")
        id_hod = whatsapp_auth_service.resolve_identity(db, "+919876500002")
        id_faculty = whatsapp_auth_service.resolve_identity(db, "+919876500003")
        id_student = whatsapp_auth_service.resolve_identity(db, "+919876500004")
        id_unreg = whatsapp_auth_service.resolve_identity(db, "+919876599999")

        assert id_principal.role == "PRINCIPAL"
        assert id_hod.role == "HOD" and id_hod.department_code == "CSE"
        assert id_faculty.role == "FACULTY" and entities["student_cse"].id in id_faculty.assigned_student_ids
        assert id_student.role == "STUDENT" and id_student.student_id == entities["student_cse"].id
        assert id_unreg.role == "UNREGISTERED" and not id_unreg.is_verified
        print("  + 4-tier role resolution (Principal, HOD, Faculty, Student, Unregistered) verified.")
        print("  + [TEST 1 PASSED]: Phone normalization & resolution operational.")

        # ---------------------------------------------------------------------
        # TEST 2: PRINCIPAL / SUPER ADMIN ROLE SCOPE
        # ---------------------------------------------------------------------
        print("\n--- [TEST 2] PRINCIPAL / SUPER ADMIN INSTITUTIONAL SCOPE ---")
        
        # 1. Overview
        res_p_ov = whatsapp_agent_service.process_incoming_message(db, "+919876500001", "/overview")
        assert res_p_ov["success"] == True
        assert res_p_ov["role"] == "PRINCIPAL"
        assert "Institutional Command" in res_p_ov["response_text"]
        print("  + Principal /overview: Institutional command overview returned.")

        # 2. College Leaderboard
        res_p_lb = whatsapp_agent_service.process_incoming_message(db, "+919876500001", "/leaderboard")
        assert res_p_lb["success"] == True
        assert "College-Wide Hall-of-Fame" in res_p_lb["response_text"]
        print("  + Principal /leaderboard: College-wide Hall-of-Fame returned.")

        # 3. Cross-Department Leaderboard Query
        res_p_lb_it = whatsapp_agent_service.process_incoming_message(db, "+919876500001", "/leaderboard IT")
        assert res_p_lb_it["success"] == True
        assert "IT Department" in res_p_lb_it["response_text"]
        print("  + Principal /leaderboard IT: Specific department query permitted.")

        # 4. Search across all departments
        res_p_search = whatsapp_agent_service.process_incoming_message(db, "+919876500001", "/search WA_IT_002")
        assert res_p_search["success"] == True
        assert "Siddharth M" in res_p_search["response_text"]
        print("  + Principal /search: Cross-department student search permitted.")
        print("  + [TEST 2 PASSED]: Principal institutional scope verified.")

        # ---------------------------------------------------------------------
        # TEST 3: HOD DEPARTMENT SCOPE & ACCESS BOUNDARIES
        # ---------------------------------------------------------------------
        print("\n--- [TEST 3] HOD DEPARTMENT SCOPE & BOUNDARY ENFORCEMENT ---")
        
        # 1. Overview
        res_h_ov = whatsapp_agent_service.process_incoming_message(db, "+919876500002", "/overview")
        assert res_h_ov["success"] == True
        assert res_h_ov["role"] == "HOD"
        assert "HOD CSE" in res_h_ov["response_text"]
        print("  + HOD /overview: Department CSE overview returned.")

        # 2. Own Department Leaderboard
        res_h_lb = whatsapp_agent_service.process_incoming_message(db, "+919876500002", "/leaderboard")
        assert res_h_lb["success"] == True
        assert "Department of CSE" in res_h_lb["response_text"]
        print("  + HOD /leaderboard: Own department leaderboard returned.")

        # 3. Cross-Department Leaderboard (MUST BE REJECTED WITH 403)
        res_h_lb_cross = whatsapp_agent_service.process_incoming_message(db, "+919876500002", "/leaderboard IT")
        assert "Access Denied" in res_h_lb_cross["response_text"]
        print("  + HOD /leaderboard IT: Cross-department request safely REJECTED (403 Access Denied).")

        # 4. Search own student
        res_h_search_own = whatsapp_agent_service.process_incoming_message(db, "+919876500002", "/search WA_CSE_001")
        assert res_h_search_own["success"] == True
        assert "Kavitha R" in res_h_search_own["response_text"]
        print("  + HOD /search: Own department student found.")

        # 5. Search other department student (MUST BE FILTERED OUT)
        res_h_search_cross = whatsapp_agent_service.process_incoming_message(db, "+919876500002", "/search WA_IT_002")
        assert "No student matching" in res_h_search_cross["response_text"] or "Access Denied" in res_h_search_cross["response_text"]
        print("  + HOD /search: Cross-department student safely FILTERED OUT.")
        print("  + [TEST 3 PASSED]: HOD department boundary enforcement verified.")

        # ---------------------------------------------------------------------
        # TEST 4: FACULTY MENTEE SCOPE & ACCESS BOUNDARIES
        # ---------------------------------------------------------------------
        print("\n--- [TEST 4] FACULTY MENTEE SCOPE & BOUNDARY ENFORCEMENT ---")
        
        # 1. Overview
        res_f_ov = whatsapp_agent_service.process_incoming_message(db, "+919876500003", "/overview")
        assert res_f_ov["success"] == True
        assert res_f_ov["role"] == "FACULTY"
        assert "Faculty Mentoring Overview" in res_f_ov["response_text"]
        print("  + Faculty /overview: Mentee group overview returned.")

        # 2. Mentees list
        res_f_m = whatsapp_agent_service.process_incoming_message(db, "+919876500003", "/mentees")
        assert res_f_m["success"] == True
        assert "Kavitha R" in res_f_m["response_text"]
        print("  + Faculty /mentees: Assigned mentees list returned.")

        # 3. Leaderboard
        res_f_lb = whatsapp_agent_service.process_incoming_message(db, "+919876500003", "/leaderboard")
        assert res_f_lb["success"] == True
        assert "Top Mentees" in res_f_lb["response_text"]
        print("  + Faculty /leaderboard: Mentee leaderboard returned.")

        # 4. Cross-mentee search (Unassigned student search MUST BE FILTERED OUT)
        res_f_search_unassigned = whatsapp_agent_service.process_incoming_message(db, "+919876500003", "/search WA_IT_002")
        assert "No student matching" in res_f_search_unassigned["response_text"]
        print("  + Faculty /search: Unassigned student query safely FILTERED OUT.")
        print("  + [TEST 4 PASSED]: Faculty mentee boundary enforcement verified.")

        # ---------------------------------------------------------------------
        # TEST 5: STUDENT SELF SCOPE & ACCESS BOUNDARIES
        # ---------------------------------------------------------------------
        print("\n--- [TEST 5] STUDENT SELF SCOPE & BOUNDARY ENFORCEMENT ---")
        
        # 1. Profile / Stats
        res_s_prof = whatsapp_agent_service.process_incoming_message(db, "+919876500004", "/profile")
        assert res_s_prof["success"] == True
        assert res_s_prof["role"] == "STUDENT"
        assert "Kavitha R" in res_s_prof["response_text"]
        assert "142 problems" in res_s_prof["response_text"]
        print("  + Student /profile: Self LeetCode profile stats returned.")

        # 2. Weekly Contest
        res_s_contest = whatsapp_agent_service.process_incoming_message(db, "+919876500004", "/contest")
        assert res_s_contest["success"] == True
        assert "Weekly Contest" in res_s_contest["response_text"]
        print("  + Student /contest: Self contest participation returned.")

        # 3. Mentor management command (MUST BE REJECTED WITH 403)
        res_s_mentees = whatsapp_agent_service.process_incoming_message(db, "+919876500004", "/mentees")
        assert "Access Denied" in res_s_mentees["response_text"]
        print("  + Student /mentees: Mentor command safely REJECTED (403 Access Denied).")

        # 4. Searching other students (MUST BE REJECTED WITH 403)
        res_s_search = whatsapp_agent_service.process_incoming_message(db, "+919876500004", "/search WA_IT_002")
        assert "Access Denied" in res_s_search["response_text"]
        print("  + Student /search: Cross-student lookup safely REJECTED (403 Access Denied).")
        print("  + [TEST 5 PASSED]: Student self scope & boundary enforcement verified.")

        # ---------------------------------------------------------------------
        # TEST 6: UNREGISTERED PHONE NUMBER HANDLING
        # ---------------------------------------------------------------------
        print("\n--- [TEST 6] UNREGISTERED PHONE NUMBER ONBOARDING ---")
        
        res_unreg = whatsapp_agent_service.process_incoming_message(db, "+919876599999", "hello")
        assert res_unreg["success"] == False
        assert res_unreg["role"] == "UNREGISTERED"
        assert "not yet linked" in res_unreg["response_text"] or "not yet registered" in res_unreg["response_text"]
        print("  + Unregistered phone number: Clean onboarding message returned.")
        print("  + [TEST 6 PASSED]: Unregistered flow verified.")

        # ---------------------------------------------------------------------
        # TEST 7: WEBHOOK API ENDPOINTS
        # ---------------------------------------------------------------------
        print("\n--- [TEST 7] WEBHOOK API ENDPOINTS & AUTH ---")
        
        # 1. Webhook GET handshake
        res_hook_get = client.get("/api/whatsapp/webhook?hub.mode=subscribe&hub.challenge=11223344&hub.verify_token=nandha_leetcode_whatsapp_verify_token_2026")
        assert res_hook_get.status_code == 200
        assert res_hook_get.text == "11223344"
        print("  + GET /api/whatsapp/webhook: Handshake verification verified.")

        # 2. Webhook POST JSON (Meta format)
        payload_meta = {
            "entry": [{
                "changes": [{
                    "value": {
                        "messages": [{
                            "from": "+919876500001",
                            "type": "text",
                            "text": {"body": "/overview"}
                        }]
                    }
                }]
            }]
        }
        res_hook_post_json = client.post("/api/whatsapp/webhook", json=payload_meta)
        assert res_hook_post_json.status_code == 200
        assert res_hook_post_json.json()["role"] == "PRINCIPAL"
        print("  + POST /api/whatsapp/webhook (Meta JSON): Inbound message parsed & processed.")

        # 3. Webhook POST Form (Twilio format)
        res_hook_post_form = client.post(
            "/api/whatsapp/webhook",
            data={"From": "whatsapp:+919876500004", "Body": "/profile"}
        )
        assert res_hook_post_form.status_code == 200
        assert res_hook_post_form.json()["role"] == "STUDENT"
        print("  + POST /api/whatsapp/webhook (Twilio Form): Inbound message parsed & processed.")

        # 4. Link number security check (HOD cannot link students from another department)
        admin = entities["principal"]
        admin_token = create_access_token({"sub": admin.username, "role": admin.role})
        headers_admin = {"Authorization": f"Bearer {admin_token}"}

        hod_token = create_access_token({"sub": entities["hod_cse"].username, "role": entities["hod_cse"].role})
        headers_hod = {"Authorization": f"Bearer {hod_token}"}

        # HOD CSE trying to link Student IT
        res_link_cross = client.post(
            "/api/whatsapp/link-number",
            json={"target_type": "STUDENT", "target_id": entities["student_it"].id, "phone_number": "+919876588888"},
            headers=headers_hod
        )
        assert res_link_cross.status_code == 403
        print("  + POST /api/whatsapp/link-number: HOD cross-department linking blocked (403 Forbidden).")
        print("  + [TEST 7 PASSED]: Webhook endpoints & API security verified.")

    print("\n" + "=" * 80)
    print("ALL 7 SECURE WHATSAPP INTEGRATION TESTS PASSED WITH 100% SUCCESS!")
    print("=" * 80)


if __name__ == "__main__":
    run_whatsapp_integration_suite()
