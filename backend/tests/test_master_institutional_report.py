"""
test_master_institutional_report.py
Tests for the Master Institutional Report Service.
"""
import pytest
import openpyxl
import io
from backend.services.master_institutional_report_service import (
    validate_source_dataset,
    normalize_student_record,
    get_mentor_signal,
    generate_master_10_sheet_workbook
)

def test_mentor_signals():
    assert get_mentor_signal(4) == "HIGH PERFORMANCE"
    assert get_mentor_signal(3) == "STRONG"
    assert get_mentor_signal(2) == "DEVELOPING"
    assert get_mentor_signal(1) == "FOUNDATION"
    assert get_mentor_signal(0) == "NO SOLVE / FOLLOW-UP"

def test_validation_gate_duplicate_reg_no():
    dataset = [
        {"reg_no": "732224CI001", "q1": 1, "q2": 1, "q3": 0, "q4": 0},
        {"reg_no": "732224CI001", "q1": 0, "q2": 0, "q3": 0, "q4": 0}
    ]
    with pytest.raises(ValueError, match="Duplicate Register No"):
        validate_source_dataset(dataset)

def test_validation_gate_invalid_q_value():
    dataset = [
        {"reg_no": "732224CI001", "q1": 5, "q2": 1, "q3": 0, "q4": 0}
    ]
    with pytest.raises(ValueError, match="Invalid Q1 value"):
        validate_source_dataset(dataset)

def test_generate_master_10_sheet_workbook():
    from backend.database import SessionLocal
    db = SessionLocal()
    try:
        excel_bytes = generate_master_10_sheet_workbook(db)
        assert len(excel_bytes) > 0

        wb = openpyxl.load_workbook(io.BytesIO(excel_bytes))
        sheet_names = wb.sheetnames

        expected_sheets = [
            "01 Principal Executive",
            "02 Complete Student Roster",
            "03 Contest Attendance",
            "04 Contest Performance",
            "05 Top Performers",
            "06 4-4 Perfect Solvers",
            "07 3-4 Solvers",
            "08 2-4 Solvers",
            "09 1-4 Solvers",
            "10 Department Intelligence",
            "_Lists"
        ]

        for expected in expected_sheets:
            assert expected in sheet_names
    finally:
        db.close()
