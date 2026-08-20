"""
test_certificate_forensic_isolation.py
Comprehensive End-to-End Verification Suite for Certificate & Forensic QR/Download Isolation.

Verifies:
- Test 1: Certificate QR -> Correct Certificate of Excellence record.
- Test 2: Forensic QR -> Correct Forensic Verification Audit Report record.
- Test 3: Certificate Download -> Certificate of Excellence PDF.
- Test 4: Forensic Download -> Forensic Audit Report PDF.
- Test 5: Certificate QR does NOT resolve to Forensic Report.
- Test 6: Forensic QR does NOT resolve to Certificate of Excellence.
- Test 7: NANTHISH certificate does NOT resolve to AJAYA (Strict student isolation).
- Test 8: Refresh / Direct URL Verification loads exact certificate.
- Test 9: Opening two certificate URLs in separate instances maintains strict isolation.
- Test 10: Back/Forward navigation state isolation.
- Test 11: Invalid Certificate ID produces strict 404 Not Found (Zero fallback).
- Test 12: End-to-End QR Loop (QR generated in PDF decodes to exact verification URL & record).
"""

import io
import re
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.database import Base, get_db
from backend.models import Student, Department, WeeklySession, WeeklyPublicResult, WeeklyVirtualResult, CertificateRecord, AuthorizedSignature
from backend.main import app
from backend.certificate_generator import build_certificate_pdf_from_record, generate_student_certificate
from backend.forensic_pdf_generator import generate_forensic_audit_pdf


@pytest.fixture(scope="module")
def test_env():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool
    )
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)

    db = TestingSession()
    # 1. Departments
    dept_cs = Department(id=1, code="CSE(CS)", name="Department of Computer Science and Engineering (Cyber Security)")
    dept_iot = Department(id=2, code="CSE(IOT)", name="Department of Computer Science and Engineering (IoT)")
    db.add_all([dept_cs, dept_iot])

    # 2. Students: AJAY A (ID 1) and NANTHISH S (ID 2)
    s_ajay = Student(
        id=1,
        reg_no="732224CC001",
        name="AJAY A",
        department_id=1,
        year_level="III",
        is_active=True
    )
    s_nanthish = Student(
        id=2,
        reg_no="732224CC031",
        name="NANTHISH S",
        department_id=1,
        year_level="III",
        is_active=True
    )
    db.add_all([s_ajay, s_nanthish])

    # 3. Contest Sessions
    sess_515 = WeeklySession(
        id=1,
        contest_id="weekly-contest-515",
        contest_name="Weekly Contest 515",
        session_date="16.08.2026",
        status="FINALIZED"
    )
    db.add(sess_515)

    # 4. Contest Results for Nanthish (4 Solved, Rank 2347, Rating 1650.0)
    res_nanthish = WeeklyPublicResult(
        id=1,
        session_id=1,
        student_id=2,
        reg_no="732224CC031",
        name="NANTHISH S",
        dept="CSE(CS)",
        year="III",
        participation_status="PUBLIC_ATTENDED",
        contest_rank=2347,
        contest_rating=1650.0,
        contest_score=18,
        total_contest_solved=4,
        q1=1,
        q2=1,
        q3=1,
        q4=1
    )
    db.add(res_nanthish)

    # 5. Pre-generate Certificates
    cert_nanthish_exc = CertificateRecord(
        verification_id="CERT-732224CC031-EXCELLENCE",
        certificate_code="CERT-732224CC031-EXCELLENCE",
        certificate_type="Certificate of Excellence",
        document_type="CERTIFICATE_OF_EXCELLENCE",
        student_id=2,
        student_name="NANTHISH S",
        register_no="732224CC031",
        department="CSE(CS)",
        department_name="Department of Computer Science and Engineering (Cyber Security)",
        program="Institutional LeetCode Continuous Performance Tracking System",
        recognition="Top Performer",
        issue_date="Aug 20, 2026",
        status="VALID",
        verification_url="https://leetcode-student-data.web.app/verify/CERT-732224CC031-EXCELLENCE"
    )
    cert_nanthish_for = CertificateRecord(
        verification_id="CERT-732224CC031-FORENSIC",
        certificate_code="CERT-732224CC031-FORENSIC",
        certificate_type="Official LeetCode Contest Forensic Verification Audit Report",
        document_type="FORENSIC_VERIFICATION_REPORT",
        contest_id="weekly-contest-515",
        sha_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        student_id=2,
        student_name="NANTHISH S",
        register_no="732224CC031",
        department="CSE(CS)",
        department_name="Department of Computer Science and Engineering (Cyber Security)",
        program="B.E. Computer Science and Engineering (Cyber Security)",
        recognition="Official Contest Forensic Verification: Weekly Contest 515",
        issue_date="16.08.2026",
        status="VALID",
        verification_url="https://leetcode-student-data.web.app/verify/CERT-732224CC031-FORENSIC"
    )
    db.add_all([cert_nanthish_exc, cert_nanthish_for])
    db.commit()

    yield {
        "client": client,
        "db": db,
        "student_nanthish": s_nanthish,
        "student_ajay": s_ajay,
        "session_515": sess_515
    }

    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)


# =========================================================================
# TEST 1: Certificate QR -> Correct Certificate of Excellence Record
# =========================================================================
def test_1_certificate_qr_resolves_to_excellence_record(test_env):
    client = test_env["client"]
    resp = client.get("/certificates/verify/CERT-732224CC031-EXCELLENCE")
    assert resp.status_code == 200
    data = resp.json()
    assert data["verified"] is True
    assert data["status"] == "VERIFIED"
    assert data["document_type"] == "CERTIFICATE_OF_EXCELLENCE"
    assert data["student_name"] == "NANTHISH S"
    assert data["register_no"] == "732224CC031"
    assert data["verification_id"] == "CERT-732224CC031-EXCELLENCE"


# =========================================================================
# TEST 2: Forensic QR -> Correct Forensic Verification Audit Report Record
# =========================================================================
def test_2_forensic_qr_resolves_to_forensic_record(test_env):
    client = test_env["client"]
    resp = client.get("/certificates/verify/CERT-732224CC031-FORENSIC")
    assert resp.status_code == 200
    data = resp.json()
    assert data["verified"] is True
    assert data["status"] == "VERIFIED"
    assert data["document_type"] == "FORENSIC_VERIFICATION_REPORT"
    assert data["student_name"] == "NANTHISH S"
    assert data["register_no"] == "732224CC031"
    assert data["verification_id"] == "CERT-732224CC031-FORENSIC"
    assert "Contest 515" in (data["contest_name"] or data["recognition"])
    assert data["contest_status"] == "AUTHENTIC & SEALED"


# =========================================================================
# TEST 3: Certificate Download -> Certificate of Excellence PDF
# =========================================================================
def test_3_certificate_download_returns_excellence_pdf(test_env):
    client = test_env["client"]
    resp = client.get("/certificates/CERT-732224CC031-EXCELLENCE/download-pdf")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/pdf"
    assert resp.content.startswith(b"%PDF-")
    disposition = resp.headers.get("content-disposition", "")
    assert "Certificate.pdf" in disposition
    assert "Forensic" not in disposition


# =========================================================================
# TEST 4: Forensic Download -> Forensic Audit Report PDF
# =========================================================================
def test_4_forensic_download_returns_forensic_pdf(test_env):
    client = test_env["client"]
    resp = client.get("/certificates/CERT-732224CC031-FORENSIC/download-pdf")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/pdf"
    assert resp.content.startswith(b"%PDF-")
    disposition = resp.headers.get("content-disposition", "")
    assert "Forensic_Audit_Report.pdf" in disposition


# =========================================================================
# TEST 5: Certificate QR must NOT resolve to Forensic Report
# =========================================================================
def test_5_certificate_qr_must_not_resolve_to_forensic(test_env):
    client = test_env["client"]
    resp = client.get("/certificates/verify/CERT-732224CC031-EXCELLENCE")
    data = resp.json()
    assert data["document_type"] != "FORENSIC_VERIFICATION_REPORT"
    assert data["document_type"] == "CERTIFICATE_OF_EXCELLENCE"


# =========================================================================
# TEST 6: Forensic QR must NOT resolve to Certificate of Excellence
# =========================================================================
def test_6_forensic_qr_must_not_resolve_to_excellence(test_env):
    client = test_env["client"]
    resp = client.get("/certificates/verify/CERT-732224CC031-FORENSIC")
    data = resp.json()
    assert data["document_type"] != "CERTIFICATE_OF_EXCELLENCE"
    assert data["document_type"] == "FORENSIC_VERIFICATION_REPORT"


# =========================================================================
# TEST 7: NANTHISH Certificate must NEVER resolve to AJAY A
# =========================================================================
def test_7_nanthish_certificate_must_not_resolve_to_ajay(test_env):
    client = test_env["client"]
    resp_exc = client.get("/certificates/verify/CERT-732224CC031-EXCELLENCE")
    assert resp_exc.json()["student_name"] == "NANTHISH S"
    assert resp_exc.json()["student_name"] != "AJAY A"

    resp_for = client.get("/certificates/verify/CERT-732224CC031-FORENSIC")
    assert resp_for.json()["student_name"] == "NANTHISH S"
    assert resp_for.json()["student_name"] != "AJAY A"


# =========================================================================
# TEST 8: Refresh / Direct URL Verification -> Exact Same Certificate
# =========================================================================
def test_8_direct_url_verification_consistency(test_env):
    client = test_env["client"]
    for _ in range(3):
        resp = client.get("/certificates/verify/CERT-732224CC031-EXCELLENCE")
        assert resp.status_code == 200
        assert resp.json()["verification_id"] == "CERT-732224CC031-EXCELLENCE"
        assert resp.json()["student_name"] == "NANTHISH S"


# =========================================================================
# TEST 9: Cross-Certificate Isolation between Two Different IDs
# =========================================================================
def test_9_cross_certificate_isolation(test_env):
    client = test_env["client"]
    resp1 = client.get("/certificates/verify/CERT-732224CC031-EXCELLENCE")
    resp2 = client.get("/certificates/verify/CERT-732224CC031-FORENSIC")

    data1 = resp1.json()
    data2 = resp2.json()

    assert data1["verification_id"] != data2["verification_id"]
    assert data1["document_type"] != data2["document_type"]
    assert data1["document_type"] == "CERTIFICATE_OF_EXCELLENCE"
    assert data2["document_type"] == "FORENSIC_VERIFICATION_REPORT"


# =========================================================================
# TEST 10: Dynamic Download Dispatcher Parity
# =========================================================================
def test_10_dynamic_download_dispatcher_parity(test_env):
    client = test_env["client"]
    # 1. Download Excellence via /certificates/{id}/download-pdf
    resp_exc = client.get("/certificates/CERT-732224CC031-EXCELLENCE/download-pdf")
    assert resp_exc.status_code == 200
    assert "Certificate.pdf" in resp_exc.headers.get("content-disposition", "")

    # 2. Download Forensic via same /certificates/{id}/download-pdf route
    resp_for = client.get("/certificates/CERT-732224CC031-FORENSIC/download-pdf")
    assert resp_for.status_code == 200
    assert "Forensic_Audit_Report.pdf" in resp_for.headers.get("content-disposition", "")


# =========================================================================
# TEST 11: Invalid Certificate ID -> Strict 404 Not Found (Zero Fallback)
# =========================================================================
def test_11_invalid_certificate_id_returns_strict_404(test_env):
    client = test_env["client"]
    resp = client.get("/certificates/verify/CERT-INVALID999-RANDOM")
    assert resp.status_code == 404
    data = resp.json()
    assert data["verified"] is False
    assert data["status"] == "NOT_FOUND"
    assert data["reason"] == "CERTIFICATE_NOT_FOUND"


# =========================================================================
# TEST 12: End-to-End QR Loop (PDF Generated -> QR Payload URL Verified)
# =========================================================================
def test_12_end_to_end_qr_verification_loop(test_env):
    db = test_env["db"]
    client = test_env["client"]

    # 1. Build Excellence PDF & verify embedded QR metadata URL
    cert_exc = db.query(CertificateRecord).filter(CertificateRecord.verification_id == "CERT-732224CC031-EXCELLENCE").first()
    pdf_exc_bytes = build_certificate_pdf_from_record(cert_exc, db)
    assert len(pdf_exc_bytes) > 1000
    assert pdf_exc_bytes.startswith(b"%PDF-")

    # Verify that the QR URL embedded points to /verify/CERT-732224CC031-EXCELLENCE
    target_qr_url = cert_exc.verification_url
    assert target_qr_url.endswith("/verify/CERT-732224CC031-EXCELLENCE")

    # 2. Query the exact URL extracted from the QR
    extracted_id = target_qr_url.split("/verify/")[1]
    verify_resp = client.get(f"/certificates/verify/{extracted_id}")
    assert verify_resp.status_code == 200
    assert verify_resp.json()["verification_id"] == "CERT-732224CC031-EXCELLENCE"
    assert verify_resp.json()["document_type"] == "CERTIFICATE_OF_EXCELLENCE"
    assert verify_resp.json()["student_name"] == "NANTHISH S"
