import pytest
from sqlalchemy.orm import Session
from backend.database import SessionLocal
from backend.models import Student, WeeklySession, WeeklyPublicResult, WeeklyVirtualResult, CertificateRecord
from backend.routes.settings import get_student_forensic_trace
from backend.routes.certificates import verify_certificate_public
from backend.forensic_pdf_generator import generate_forensic_audit_pdf

def test_forensic_verification_dynamic_isolation():
    db: Session = SessionLocal()
    try:
        # Fetch test students and sessions from DB
        nanthish = db.query(Student).filter(
            (Student.name.ilike("%NANTHISH%")) | (Student.reg_no.ilike("%732224CC031%"))
        ).first()

        kiruthika = db.query(Student).filter(
            (Student.name.ilike("%KIRUTHIKA%")) | (Student.reg_no.ilike("%732224CI020%"))
        ).first()

        sessions = db.query(WeeklySession).order_by(WeeklySession.id.asc()).all()

        if not nanthish or not sessions:
            pytest.skip("Database does not contain required seed data for forensic verification test.")

        sess_1 = sessions[0]
        sess_2 = sessions[1] if len(sessions) > 1 else sessions[0]

        # Case A: NANTHISH + Session 1
        res_nanthish_1 = get_student_forensic_trace(search=nanthish.reg_no, session_id=sess_1.id, db=db)
        assert res_nanthish_1["status"] == "SUCCESS"
        assert res_nanthish_1["student"]["reg_no"] == nanthish.reg_no
        assert res_nanthish_1["student"]["name"] == nanthish.name
        assert res_nanthish_1["contest"]["sessionId"] == sess_1.id
        trace_id_1 = res_nanthish_1["traceId"]

        # Verify QR / Public Verification API returns the EXACT SAME Student x Contest object
        public_verify_1 = verify_certificate_public(verification_id=trace_id_1, db=db)
        # Parse JSON content if response is JSONResponse
        if hasattr(public_verify_1, "body"):
            import json
            data_1 = json.loads(public_verify_1.body.decode())
        else:
            data_1 = public_verify_1

        assert data_1["verified"] is True
        assert data_1["register_no"] == nanthish.reg_no
        assert data_1["student_name"] == nanthish.name

        # Case B: NANTHISH + Session 2 (Different Contest)
        if sess_2.id != sess_1.id:
            res_nanthish_2 = get_student_forensic_trace(search=nanthish.reg_no, session_id=sess_2.id, db=db)
            assert res_nanthish_2["status"] == "SUCCESS"
            assert res_nanthish_2["contest"]["sessionId"] == sess_2.id
            assert res_nanthish_2["traceId"] != trace_id_1  # Must generate unique trace ID

        # Case C: KIRUTHIKA + Session 1 / Session 2
        if kiruthika:
            res_kiruthika = get_student_forensic_trace(search=kiruthika.reg_no, session_id=sess_1.id, db=db)
            assert res_kiruthika["status"] == "SUCCESS"
            assert res_kiruthika["student"]["reg_no"] == kiruthika.reg_no
            assert res_kiruthika["student"]["name"] == kiruthika.name
            assert res_kiruthika["student"]["reg_no"] != nanthish.reg_no

            # Verify public API for Kiruthika never leaks Nanthish data
            pub_kiruthika = verify_certificate_public(verification_id=res_kiruthika["traceId"], db=db)
            if hasattr(pub_kiruthika, "body"):
                import json
                data_k = json.loads(pub_kiruthika.body.decode())
            else:
                data_k = pub_kiruthika
            assert data_k["register_no"] == kiruthika.reg_no

        # Case D: PDF Generation test for specific Student x Contest
        pdf_bytes = generate_forensic_audit_pdf(db=db, student_id=nanthish.id, session_id=sess_1.id, trace_id=trace_id_1)
        assert isinstance(pdf_bytes, bytes)
        assert len(pdf_bytes) > 1000

    finally:
        db.close()

def test_forensic_verification_invalid_student_404():
    db: Session = SessionLocal()
    try:
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc_info:
            get_student_forensic_trace(search="NON_EXISTENT_STUDENT_999999", session_id=1, db=db)
        assert exc_info.value.status_code == 404
    finally:
        db.close()
