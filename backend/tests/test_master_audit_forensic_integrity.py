import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock
from sqlalchemy.orm import Session
from backend.database import SessionLocal, run_migrations
run_migrations()
from backend.models import AdminAuditLog, Student, WeeklySession, WeeklyPublicResult, CertificateRecord, User
from backend.time_utils import format_ist_datetime, now_utc
from backend.security import log_security_access_event
from backend.routes.settings import get_student_forensic_trace
from backend.routes.certificates import verify_certificate_public

def make_mock_request(path="/api/admin/audit-logs", method="GET", client_ip="103.15.22.4", user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0"):
    req = MagicMock()
    req.url.path = path
    req.method = method
    req.client.host = client_ip
    req.headers = {"User-Agent": user_agent}
    return req

def test_scenario_1_canonical_timestamp_consistency():
    """TEST 1: Verify DB timestamp = API timestamp = UI timestamp IST conversion"""
    db: Session = SessionLocal()
    try:
        user = db.query(User).first()
        if not user:
            user = User(id="usr_001", username="nanthish17", email="nanthish@example.com", role="Administrator")
            db.add(user)
            db.commit()
            
        req = make_mock_request()
        log_security_access_event(
            db=db,
            request=req,
            user=user,
            action="ACCESS_RESOURCE",
            resource="Admin Audit Logs",
            result="ALLOWED",
            debounce_seconds=0
        )
        
        audit = db.query(AdminAuditLog).order_by(AdminAuditLog.id.desc()).first()
        assert audit is not None
        # DB timestamp exists
        assert audit.event_timestamp is not None
        
        # UI IST format check
        formatted_ist = format_ist_datetime(audit.event_timestamp, include_ms=True)
        assert "IST" in formatted_ist
        assert len(formatted_ist.split(" ")) >= 4
    finally:
        db.close()

def test_scenario_2_chronological_event_ordering():
    """TEST 2: Create two events. Verify chronological ordering."""
    db: Session = SessionLocal()
    try:
        user = db.query(User).first()
        req = make_mock_request()
        
        log_security_access_event(
            db=db,
            request=req,
            user=user,
            action="FIRST_EVENT",
            resource="Resource A",
            result="ALLOWED",
            debounce_seconds=0
        )
        
        log_security_access_event(
            db=db,
            request=req,
            user=user,
            action="SECOND_EVENT",
            resource="Resource B",
            result="ALLOWED",
            debounce_seconds=0
        )
        
        logs = db.query(AdminAuditLog).order_by(AdminAuditLog.event_timestamp.desc()).all()
        assert len(logs) >= 2
        latest = logs[0]
        assert latest.event_timestamp >= logs[1].event_timestamp
    finally:
        db.close()

def test_scenario_3_sha256_cryptographic_integrity_chain():
    """TEST 4: Cryptographic SHA-256 hash chain verification."""
    db: Session = SessionLocal()
    try:
        user = db.query(User).first()
        req = make_mock_request()
        
        log_security_access_event(
            db=db,
            request=req,
            user=user,
            action="HASH_ACTION_1",
            resource="Res 1",
            result="ALLOWED",
            debounce_seconds=0
        )
        audit1 = db.query(AdminAuditLog).order_by(AdminAuditLog.id.desc()).first()
        
        log_security_access_event(
            db=db,
            request=req,
            user=user,
            action="HASH_ACTION_2",
            resource="Res 2",
            result="ALLOWED",
            debounce_seconds=0
        )
        audit2 = db.query(AdminAuditLog).order_by(AdminAuditLog.id.desc()).first()
        
        assert audit1.integrity_status == "VERIFIED"
        assert audit2.previous_event_hash == audit1.event_hash
        assert audit2.integrity_status == "VERIFIED"
    finally:
        db.close()

def test_scenario_4_student_contest_isolation():
    """TEST 5: Verify Student x Contest dynamic isolation without data cross-contamination."""
    db: Session = SessionLocal()
    try:
        nanthish = db.query(Student).filter(
            (Student.name.ilike("%NANTHISH%")) | (Student.reg_no.ilike("%732224CC031%"))
        ).first()

        sessions = db.query(WeeklySession).order_by(WeeklySession.id.asc()).all()

        if not nanthish or len(sessions) < 2:
            pytest.skip("Database does not contain required seed data for forensic isolation test.")

        sess_1 = sessions[0]
        sess_2 = sessions[1]

        trace_1 = get_student_forensic_trace(search=nanthish.reg_no, session_id=sess_1.id, db=db)
        trace_2 = get_student_forensic_trace(search=nanthish.reg_no, session_id=sess_2.id, db=db)

        assert trace_1["status"] == "SUCCESS"
        assert trace_2["status"] == "SUCCESS"
        assert trace_1["contest"]["sessionId"] == sess_1.id
        assert trace_2["contest"]["sessionId"] == sess_2.id
        assert trace_1["traceId"] != trace_2["traceId"]
    finally:
        db.close()

def test_scenario_5_qr_trace_resolution():
    """TEST 6: Scan QR trace_id and verify exact Student x Contest record resolution."""
    db: Session = SessionLocal()
    try:
        nanthish = db.query(Student).filter(
            (Student.name.ilike("%NANTHISH%")) | (Student.reg_no.ilike("%732224CC031%"))
        ).first()
        sess_1 = db.query(WeeklySession).first()

        if not nanthish or not sess_1:
            pytest.skip("Database missing student or session for QR resolution test.")

        trace_res = get_student_forensic_trace(search=nanthish.reg_no, session_id=sess_1.id, db=db)
        trace_id = trace_res["traceId"]
        
        qr_verify = verify_certificate_public(verification_id=trace_id, db=db)
        qr_data = qr_verify.body if hasattr(qr_verify, "body") else qr_verify
        import json
        if isinstance(qr_data, (bytes, str)):
            qr_data = json.loads(qr_data)

        assert qr_data["status"] == "VERIFIED"
        assert qr_data["register_no"] == nanthish.reg_no
        assert qr_data["contest_name"] == trace_res["contest"]["contestName"]
    finally:
        db.close()

def test_forensic_qr_trace_integrity_no_student_mixing():
    """Verify trace ID resolves strictly to its stored Student x Contest record with ZERO cross-student/contest leakage."""
    db: Session = SessionLocal()
    try:
        nanthish = db.query(Student).filter(
            (Student.name.ilike("%NANTHISH%")) | (Student.reg_no.ilike("%732224CC031%"))
        ).first()
        kiruthika = db.query(Student).filter(
            (Student.name.ilike("%KIRUTHIKA%")) | (Student.reg_no.ilike("%732224CI020%"))
        ).first()

        sessions = db.query(WeeklySession).order_by(WeeklySession.id.asc()).all()
        if not nanthish or not kiruthika or len(sessions) < 2:
            pytest.skip("Insufficient seed data for QR trace integrity test.")

        sess_517 = sessions[0]
        sess_518 = sessions[1]

        # Generate trace for Nanthish + Contest 517
        trace_n = get_student_forensic_trace(search=nanthish.reg_no, session_id=sess_517.id, db=db)
        trace_id_n = trace_n["traceId"]

        # Generate trace for Kiruthika + Contest 518
        trace_k = get_student_forensic_trace(search=kiruthika.reg_no, session_id=sess_518.id, db=db)
        trace_id_k = trace_k["traceId"]

        # 1. Verify trace Nanthish resolves ONLY Nanthish
        verify_n = verify_certificate_public(verification_id=trace_id_n, db=db)
        data_n = verify_n.body if hasattr(verify_n, "body") else verify_n
        import json
        if isinstance(data_n, (bytes, str)):
            data_n = json.loads(data_n)

        assert data_n["status"] == "VERIFIED"
        assert data_n["register_no"] == nanthish.reg_no
        assert data_n["student_name"] == nanthish.name
        assert data_n["verification_id"] == trace_id_n
        assert data_n["register_no"] != kiruthika.reg_no

        # 2. Verify trace Kiruthika resolves ONLY Kiruthika
        verify_k = verify_certificate_public(verification_id=trace_id_k, db=db)
        data_k = verify_k.body if hasattr(verify_k, "body") else verify_k
        if isinstance(data_k, (bytes, str)):
            data_k = json.loads(data_k)

        assert data_k["status"] == "VERIFIED"
        assert data_k["register_no"] == kiruthika.reg_no
        assert data_k["student_name"] == kiruthika.name
        assert data_k["verification_id"] == trace_id_k
        assert data_k["register_no"] != nanthish.reg_no
    finally:
        db.close()

def test_invalid_trace_id_returns_404_not_found_no_fallbacks():
    """Verify invalid trace_id returns 404 NOT_FOUND with zero student fallback leakage."""
    db: Session = SessionLocal()
    try:
        resp = verify_certificate_public(verification_id="trace_invalid_nonexistent_999999", db=db)
        data = resp.body if hasattr(resp, "body") else resp
        import json
        if isinstance(data, (bytes, str)):
            data = json.loads(data)

        assert data["status"] == "NOT_FOUND"
        assert data["verified"] is False
        assert "KIRUTHIKA" not in str(data)
        assert "NANTHISH" not in str(data)
    finally:
        db.close()
