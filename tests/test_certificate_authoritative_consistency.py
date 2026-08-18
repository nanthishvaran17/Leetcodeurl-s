from __future__ import annotations

import pytest
import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.database import Base
from backend.models import (
    Student, Department, WeeklySession, WeeklyPublicResult, CertificateRecord
)
from backend.routes.certificates import resolve_certificate_record
from backend.certificate_generator import build_certificate_pdf_from_record

@pytest.fixture
def cert_db():
    engine = create_engine("sqlite:///:memory:", echo=False)
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = Session()

    # 1. Seed Department
    dept = Department(id=1, code="CSE(CS)", name="Computer Science and Engineering (Cyber Security)")
    session.add(dept)

    # 2. Seed Student
    student = Student(
        id=1,
        reg_no="732224CC031",
        name="NANTHISH S",
        username="nanthish",
        department_id=1,
        year_level="III",
        is_active=True
    )
    session.add(student)

    # 3. Seed Contest 515
    session_515 = WeeklySession(
        id=1,
        contest_id="weekly-contest-515",
        contest_name="Weekly Contest 515",
        session_date="16.08.2026",
        status="FINALIZED"
    )
    session.add(session_515)

    # 4. Seed Verified Participation in 515
    res_515 = WeeklyPublicResult(
        id=1,
        session_id=1,
        student_id=1,
        reg_no="732224CC031",
        name="NANTHISH S",
        dept="CSE(CS)",
        year="III",
        participation_status="PUBLIC",
        contest_rank=2347,
        contest_rating=1541.0,
        total_contest_solved=3,
        contest_score=12
    )
    session.add(res_515)

    session.commit()

    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


def test_certificate_resolves_exact_verified_contest_515(cert_db):
    """Test A: Student participated in Weekly Contest 515 -> Certificate strictly reflects 515."""
    cert = resolve_certificate_record(
        db=cert_db,
        verification_id="trace_test_515",
        reg="732224CC031",
        contest="515"
    )

    assert cert is not None
    assert "Weekly Contest 515" in cert.recognition
    assert cert.issue_date == "16.08.2026"
    assert cert.student_name == "NANTHISH S"
    assert cert.register_no == "732224CC031"


def test_certificate_rejects_unparticipated_contest_516(cert_db):
    """Test B: Student requests Weekly Contest 516 with no participation -> Returns None (No fake cert)."""
    cert = resolve_certificate_record(
        db=cert_db,
        verification_id="trace_test_516",
        reg="732224CC031",
        contest="516"
    )

    # Must be None because student only participated in 515
    assert cert is None


def test_certificate_pdf_generation_is_valid_pdf(cert_db):
    """Test C: PDF generation produces authoritative %PDF- bytes without corruption."""
    cert = resolve_certificate_record(
        db=cert_db,
        verification_id="trace_pdf_check",
        reg="732224CC031",
        contest="515"
    )
    assert cert is not None

    pdf_bytes = build_certificate_pdf_from_record(cert, cert_db)
    assert pdf_bytes is not None
    assert len(pdf_bytes) > 1000
    assert pdf_bytes.startswith(b"%PDF-")


def test_certificate_parity_with_audit_session(cert_db):
    """Test D: Certificate data exactly matches authoritative WeeklySession database record."""
    session_515 = cert_db.query(WeeklySession).filter(WeeklySession.id == 1).first()
    cert = resolve_certificate_record(
        db=cert_db,
        verification_id="trace_parity_check",
        reg="732224CC031"
    )

    assert cert is not None
    assert session_515.contest_name in cert.recognition
    assert cert.issue_date == session_515.session_date
