import os
import io
import unittest
import datetime
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.database import Base, get_db
from backend.models import Student, Department, CertificateRecord, AuthorizedSignature, WeeklySession, WeeklyPublicResult
from backend.certificate_generator import (
    generate_student_certificate,
    build_certificate_pdf_from_record,
    render_certificate_pdf_bytes,
    resolve_department_name
)
from backend.main import app


from sqlalchemy.pool import StaticPool

class TestCertificatePdfEndToEnd(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Setup in-memory SQLite DB with StaticPool so all connections share the same memory DB
        cls.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool
        )
        cls.TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=cls.engine)
        Base.metadata.create_all(bind=cls.engine)

        def override_get_db():
            db = cls.TestingSessionLocal()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override_get_db
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        app.dependency_overrides.clear()
        Base.metadata.drop_all(bind=cls.engine)

    def setUp(self):
        self.db = self.TestingSessionLocal()
        # Clean all tables before each test
        self.db.query(CertificateRecord).delete()
        self.db.query(WeeklyPublicResult).delete()
        self.db.query(WeeklySession).delete()
        self.db.query(Student).delete()
        self.db.query(AuthorizedSignature).delete()
        self.db.query(Department).delete()
        self.db.commit()

        # Seed test department
        self.dept = Department(name="Computer Science and Engineering (Cyber Security)", code="CSE(CS)")
        self.db.add(self.dept)
        self.db.commit()
        self.db.refresh(self.dept)

        # Seed test student
        self.student = Student(
            name="NANTHISH S",
            reg_no="732224CC031",
            department_id=self.dept.id,
            year_level="II",
            username="nanthish_s"
        )
        self.db.add(self.student)

        # Seed test principal signature
        self.sig = AuthorizedSignature(
            signature_type="PRINCIPAL",
            department="ALL",
            signatory_title="Principal",
            signatory_name="Dr. Principal",
            version="v1",
            is_active=True
        )
        self.db.add(self.sig)
        self.db.commit()
        self.db.refresh(self.student)

    def tearDown(self):
        self.db.close()

    def test_pdf_generation_from_record_in_memory(self):
        """Test build_certificate_pdf_from_record generates valid PDF bytes from verified record."""
        cert = CertificateRecord(
            verification_id="CERT-TEST1234",
            certificate_type="Top Performer",
            student_id=self.student.id,
            student_name=self.student.name,
            register_no=self.student.reg_no,
            department="CSE(CS)",
            department_name="Department of Computer Science and Engineering (Cyber Security)",
            program="Institutional LeetCode Continuous Performance Tracking System",
            recognition="Top Performer",
            issue_date="Aug 18, 2026",
            status="VALID",
            verification_url="https://leetcode-student-data.web.app/verify/CERT-TEST1234",
            created_by="Admin"
        )
        self.db.add(cert)
        self.db.commit()
        self.db.refresh(cert)

        pdf_bytes = build_certificate_pdf_from_record(cert, self.db)
        self.assertIsInstance(pdf_bytes, bytes)
        self.assertGreater(len(pdf_bytes), 1000)
        self.assertTrue(pdf_bytes.startswith(b"%PDF-"), "Output does not start with %PDF- header")

    def test_download_endpoint_valid_certificate_auto_regenerates_when_missing(self):
        """Test download endpoint automatically regenerates PDF if file is missing on disk."""
        cert = CertificateRecord(
            verification_id="CERT-REGEN001",
            certificate_type="Top Performer",
            student_id=self.student.id,
            student_name=self.student.name,
            register_no=self.student.reg_no,
            department="CSE(CS)",
            department_name="Department of Computer Science and Engineering (Cyber Security)",
            program="Institutional LeetCode Continuous Performance Tracking System",
            recognition="Top Performer",
            issue_date="Aug 18, 2026",
            status="VALID",
            pdf_path="/non/existent/path/on/ephemeral/server.pdf",
            verification_url="https://leetcode-student-data.web.app/verify/CERT-REGEN001",
            created_by="Admin"
        )
        self.db.add(cert)
        self.db.commit()

        # Request download from API endpoint
        resp = self.client.get("/api/certificates/CERT-REGEN001/download-pdf")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.headers.get("content-type"), "application/pdf")
        self.assertIn("attachment; filename=", resp.headers.get("content-disposition", ""))
        self.assertIn("NANTHISH_S", resp.headers.get("content-disposition", ""))
        self.assertTrue(resp.content.startswith(b"%PDF-"))
        self.assertGreater(len(resp.content), 1000)

    def test_download_endpoint_with_case_insensitive_variants(self):
        """Test download endpoint resolves case-insensitive ID and prefix variants."""
        cert = CertificateRecord(
            verification_id="CERT-VARIANT1",
            certificate_type="Top Performer",
            student_id=self.student.id,
            student_name=self.student.name,
            register_no=self.student.reg_no,
            department="CSE(CS)",
            department_name="Department of Computer Science and Engineering (Cyber Security)",
            program="Institutional LeetCode Continuous Performance Tracking System",
            recognition="Top Performer",
            issue_date="Aug 18, 2026",
            status="VALID",
            verification_url="https://leetcode-student-data.web.app/verify/CERT-VARIANT1",
            created_by="Admin"
        )
        self.db.add(cert)
        self.db.commit()

        # Lowercase request
        resp_lower = self.client.get("/api/certificates/cert-variant1/download-pdf")
        self.assertEqual(resp_lower.status_code, 200)
        self.assertEqual(resp_lower.headers.get("content-type"), "application/pdf")

        # Without CERT- prefix
        resp_noprefix = self.client.get("/api/certificates/VARIANT1/download-pdf")
        self.assertEqual(resp_noprefix.status_code, 200)
        self.assertEqual(resp_noprefix.headers.get("content-type"), "application/pdf")

    def test_download_endpoint_invalid_certificate_404(self):
        """Test non-existent certificate returns 404 with clean message."""
        resp = self.client.get("/api/certificates/CERT-DOESNOTEXIST999/download-pdf")
        self.assertEqual(resp.status_code, 404)
        self.assertIn("does not exist", resp.json()["detail"])

    def test_download_endpoint_revoked_certificate_400(self):
        """Test revoked certificate returns 400 error."""
        cert = CertificateRecord(
            verification_id="CERT-REVOKED01",
            certificate_type="Top Performer",
            student_id=self.student.id,
            student_name=self.student.name,
            register_no=self.student.reg_no,
            department="CSE(CS)",
            department_name="Department of Computer Science and Engineering (Cyber Security)",
            program="Institutional LeetCode Continuous Performance Tracking System",
            recognition="Top Performer",
            issue_date="Aug 18, 2026",
            status="REVOKED",
            revocation_reason="Student transferred",
            verification_url="https://leetcode-student-data.web.app/verify/CERT-REVOKED01",
            created_by="Admin"
        )
        self.db.add(cert)
        self.db.commit()

        resp = self.client.get("/api/certificates/CERT-REVOKED01/download-pdf")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("Student transferred", resp.json()["detail"])

    def test_dynamic_resolution_for_student_reg_number(self):
        """Test dynamically resolving and generating PDF for a verified student register number."""
        resp = self.client.get(f"/api/certificates/{self.student.reg_no}/download-pdf")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.headers.get("content-type"), "application/pdf")
        self.assertTrue(resp.content.startswith(b"%PDF-"))
        self.assertIn("NANTHISH_S", resp.headers.get("content-disposition", ""))

    def test_verify_endpoint_and_download_pdf_contain_matching_data(self):
        """Test that the public verification JSON and generated PDF are built from identical record data."""
        cert = CertificateRecord(
            verification_id="CERT-MATCHING01",
            certificate_type="Top Performer",
            student_id=self.student.id,
            student_name="PRIYA DHARSHINI",
            register_no="732224CC045",
            department="CSE(CS)",
            department_name="Department of Computer Science and Engineering (Cyber Security)",
            program="Institutional LeetCode Continuous Performance Tracking System",
            recognition="Top Performer",
            issue_date="Aug 18, 2026",
            status="VALID",
            verification_url="https://leetcode-student-data.web.app/verify/CERT-MATCHING01",
            created_by="Admin"
        )
        self.db.add(cert)
        self.db.commit()

        # 1. Verify JSON metadata
        v_resp = self.client.get("/api/certificates/verify/CERT-MATCHING01")
        self.assertEqual(v_resp.status_code, 200)
        v_data = v_resp.json()
        self.assertEqual(v_data["student_name"], "PRIYA DHARSHINI")
        self.assertEqual(v_data["register_no"], "732224CC045")
        self.assertEqual(v_data["verification_id"], "CERT-MATCHING01")

        # 2. Download PDF
        d_resp = self.client.get("/api/certificates/CERT-MATCHING01/download-pdf")
        self.assertEqual(d_resp.status_code, 200)
        self.assertEqual(d_resp.headers.get("content-type"), "application/pdf")
        self.assertIn("PRIYA_DHARSHINI", d_resp.headers.get("content-disposition", ""))
        self.assertTrue(d_resp.content.startswith(b"%PDF-"))


if __name__ == "__main__":
    unittest.main()
