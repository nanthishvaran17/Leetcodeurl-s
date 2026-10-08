import io
import pandas as pd  # type: ignore
import pytest
from backend.database import SessionLocal
from backend.models import Student, Department, User, LeetCodeProfileStats
from backend.services.excel_intelligence_engine import (
    detect_column_headers,
    find_best_header_row_and_dataframe,
    normalize_year_value,
    normalize_batch_value,
    normalize_department_value,
    normalize_leetcode_url
)
from backend.services.excel_import_service import (
    analyze_excel_import,
    commit_smart_excel_import
)

def test_smart_header_row_detection():
    """Verify smart header row auto-detection skips title banner rows (e.g., date, college name)."""
    raw_rows = [
        ["NANDHA INTELLIGENCE", "302 STUDENTS", "27-09-2026", None, None],
        ["Register No", "Student Name", "Department", "Academic Year", "LeetCode Profile"],
        ["732225IT046", "John Doe", "IT", "III Yr", "https://leetcode.com/u/johndoe/"]
    ]
    df_raw = pd.DataFrame(raw_rows)
    buf = io.BytesIO()
    df_raw.to_excel(buf, index=False, header=False)
    file_bytes = buf.getvalue()

    df_clean, detected_headers = find_best_header_row_and_dataframe(file_bytes)

    assert "Register No" in detected_headers
    assert "Student Name" in detected_headers
    assert "Department" in detected_headers
    assert len(df_clean) == 1
    assert df_clean.iloc[0]["Register No"] == "732225IT046"

    mapped, conf, unmapped = detect_column_headers(detected_headers)
    assert mapped["Register No"] == "reg_no"
    assert mapped["Student Name"] == "name"
    assert mapped["Department"] == "department"
    assert mapped["Academic Year"] == "year_level"
    assert mapped["LeetCode Profile"] == "leetcode_url"

def test_header_detection_variations():
    """Verify intelligent column header detection across different column names."""
    headers_a = ["REG NO", "NAME", "DEPT", "YEAR", "EMAIL", "PRIMARY LEETCODE LINK"]
    mapped_a, conf_a, unmapped_a = detect_column_headers(headers_a)
    assert mapped_a["REG NO"] == "reg_no"
    assert mapped_a["NAME"] == "name"
    assert mapped_a["DEPT"] == "department"
    assert mapped_a["YEAR"] == "year_level"
    assert mapped_a["EMAIL"] == "email"
    assert mapped_a["PRIMARY LEETCODE LINK"] == "leetcode_url"

    headers_b = ["Roll Number", "Student Name", "Branch", "Batch", "Mail ID", "LeetCode URL"]
    mapped_b, conf_b, unmapped_b = detect_column_headers(headers_b)
    assert mapped_b["Roll Number"] == "reg_no"
    assert mapped_b["Student Name"] == "name"
    assert mapped_b["Branch"] == "department"
    assert mapped_b["Mail ID"] == "email"
    assert mapped_b["LeetCode URL"] == "leetcode_url"

def test_year_normalization():
    """Test year normalization logic across roman, word, and ordinal formats."""
    assert normalize_year_value("1")[0] == "I Year"
    assert normalize_year_value("II")[0] == "II Year"
    assert normalize_year_value("Second Year")[0] == "II Year"
    assert normalize_year_value("3rd")[0] == "III Year"
    assert normalize_year_value("4th Year")[0] == "IV Year"

def test_academic_batch_normalization():
    """Test academic batch normalization."""
    assert normalize_batch_value("2023-2027")[0] == "2023-2027"
    assert normalize_batch_value("23-27")[0] == "2023-2027"
    assert normalize_batch_value("2023 to 2027")[0] == "2023-2027"

def test_department_intelligence():
    """Test department code resolution and new department detection."""
    existing_depts = {
        "CSE": type('Dept', (), {'code': 'CSE', 'id': 1}),
        "IT": type('Dept', (), {'code': 'IT', 'id': 2})
    }
    # Existing department match
    code, dept_id, conf, is_new = normalize_department_value("C.S.E", existing_depts)
    assert code == "CSE"
    assert is_new is False

    # New department detection
    code_new, _, _, is_new_dept = normalize_department_value("EEE", existing_depts)
    assert code_new == "EEE"
    assert is_new_dept is True

def test_leetcode_url_normalization():
    """Test LeetCode URL handle extraction."""
    url1, username1 = normalize_leetcode_url("https://leetcode.com/u/john_doe/")
    assert username1 == "john_doe"
    assert "leetcode.com/u/john_doe/" in url1  # type: ignore

    url2, username2 = normalize_leetcode_url("jane_smith")
    assert username2 == "jane_smith"

def test_analyze_and_commit_import_flow():
    """Test full analyze and commit flow with CREATE, UPDATE, UNCHANGED, and new department registration."""
    db = SessionLocal()
    try:
        def _cleanup():
            import sqlalchemy
            db.execute(sqlalchemy.text("PRAGMA foreign_keys=OFF"))
            test_sts = db.query(Student).filter(Student.reg_no.in_(["TEST99901", "TEST99902"])).all()
            if test_sts:
                st_ids = [s.id for s in test_sts]
                db.query(Student).filter(Student.id.in_(st_ids)).delete(synchronize_session=False)
            db.query(Department).filter(Department.code == "EEE").delete(synchronize_session=False)
            db.commit()
            db.execute(sqlalchemy.text("PRAGMA foreign_keys=ON"))

        _cleanup()

        # Create test Excel file in-memory
        df_data = pd.DataFrame([
            {
                "Register No": "TEST99901",
                "Full Name": "Test Student Alpha",
                "Branch": "CSE",
                "Academic Year": "II",
                "Email ID": "alpha99901@nandha.edu.in",
                "LeetCode Link": "https://leetcode.com/u/alpha99901/"
            },
            {
                "Register No": "TEST99902",
                "Full Name": "Test Student EEE",
                "Branch": "EEE",
                "Academic Year": "3rd Year",
                "Email ID": "eee99902@nandha.edu.in",
                "LeetCode Link": "https://leetcode.com/u/eee99902/"
            }
        ])

        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df_data.to_excel(writer, index=False)
        excel_bytes = output.getvalue()

        # Step 1: Analyze import
        analysis = analyze_excel_import(excel_bytes)
        assert analysis["success"] is True
        assert analysis["summary"]["total_rows"] == 2
        assert "EEE" in analysis["summary"]["new_departments"]

        # Step 2: Commit import
        commit_res = commit_smart_excel_import(
            file_bytes=excel_bytes,
            confirmed_new_departments=["EEE"]
        )

        assert commit_res["success"] is True
        assert commit_res["summary"]["new_students"] >= 1
        assert "EEE" in commit_res["new_departments_created"] or "EEE" in [d.code for d in db.query(Department).all()]

        # Verify Student database record
        st1 = db.query(Student).filter(Student.reg_no == "TEST99901").first()
        assert st1 is not None
        assert st1.name == "Test Student Alpha"
        assert st1.year_level == "II Year"

        st2 = db.query(Student).filter(Student.reg_no == "TEST99902").first()
        assert st2 is not None
        assert st2.department.code == "EEE"

        # Step 3: Re-import same data with name update
        df_update = pd.DataFrame([
            {
                "Register No": "TEST99901",
                "Full Name": "Test Student Alpha Updated",
                "Branch": "CSE",
                "Academic Year": "II",
                "Email ID": "alpha99901@nandha.edu.in",
                "LeetCode Link": "https://leetcode.com/u/alpha99901/"
            }
        ])
        output_up = io.BytesIO()
        with pd.ExcelWriter(output_up, engine='openpyxl') as writer:
            df_update.to_excel(writer, index=False)
        excel_bytes_up = output_up.getvalue()

        commit_res_up = commit_smart_excel_import(file_bytes=excel_bytes_up)
        assert commit_res_up["summary"]["existing_updated"] == 1
        assert commit_res_up["summary"]["new_students"] == 0

        db.expire_all()
        st1_updated = db.query(Student).filter(Student.reg_no == "TEST99901").first()
        assert st1_updated.name == "Test Student Alpha Updated"  # type: ignore

        _cleanup()

    finally:
        db.close()
