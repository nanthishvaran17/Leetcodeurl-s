import openpyxl
from backend.database import SessionLocal
from backend.services.canonical_contest_engine import build_canonical_contest_dataset
from backend.exporters.excel_exporter import export_excel_from_dataset
from backend.routes.weekly_contests import get_session_matrix
from backend.routes.reports import _get_dataset_for_id

def run_full_accuracy_audit():
    print("================================================================================")
    print("NANDHA ENGINEERING COLLEGE — LEETCODE DATA ACCURACY & RECONCILIATION AUDIT")
    print("================================================================================")

    db = SessionLocal()
    session_id = 5

    # 1. Test Canonical Dataset Generation
    dataset = build_canonical_contest_dataset(session_id, db)
    total_master = dataset["metrics"]["totalStudents"]
    all_rows = dataset["all_rows"]

    print(f"\n1. CANONICAL DATASET INTEGRITY:")
    print(f"   - Contest: {dataset['contestName']} ({dataset['sessionDate']})")
    print(f"   - Total Master Roster Count: {total_master} Students")
    print(f"   - Public Attended: {dataset['statusCounts']['PUBLIC']}")
    print(f"   - Virtual Attended: {dataset['statusCounts']['VIRTUAL']}")
    print(f"   - Confirmed Not Attended: {dataset['statusCounts']['NOT_ATTENDED']}")
    print(f"   - Explicit Quality Issues / Data Errors: {dataset['statusCounts']['DATA_ERROR']}")
    print(f"   - Participation Rate: {dataset['metrics']['participationPercentage']}%")
    assert total_master > 0, f"Expected active master students, got {total_master}"
    print(f"   [PASS] Master Student Count verified ({total_master} students).")

    # 2. Mathematical Reconciliation Verification
    reconciliation = dataset["reconciliation"]
    print(f"\n2. MATHEMATICAL RECONCILIATION ENGINE:")
    print(f"   - Master Count: {reconciliation['masterCount']}")
    print(f"   - Sum of Department Totals: {reconciliation['deptSum']}")
    print(f"   - Sum of Year Totals: {reconciliation['yearSum']}")
    print(f"   - Sum of Status Category Totals: {reconciliation['statusSum']}")
    print(f"   - Gatekeeper Status: {'PASSED' if reconciliation['passed'] else 'FAILED'}")
    assert reconciliation["passed"] is True, "Reconciliation failed!"
    print("   [PASS] 100% Department, Year, and Status Reconciliation verified.")

    # 3. Question-Wise Sum and Authenticity Rule
    print(f"\n3. QUESTION-WISE FORMULA & NULL INTEGRITY CHECK:")
    participants_checked = 0
    non_participants_checked = 0
    for r in all_rows:
        status = r["status"]
        if status in ("PUBLIC", "VIRTUAL"):
            participants_checked += 1
            q1 = r["q1"] or 0
            q2 = r["q2"] or 0
            q3 = r["q3"] or 0
            q4 = r["q4"] or 0
            solved = r["total_solved"]
            assert solved == (q1 + q2 + q3 + q4), f"Mismatch for {r['reg_no']}: solved={solved} != sum({q1},{q2},{q3},{q4})"
            assert q1 in (0, 1) and q2 in (0, 1) and q3 in (0, 1) and q4 in (0, 1)
        else:
            non_participants_checked += 1
            # Must not have fake question counts
            assert r["q1"] is None or r["q1"] == "—"
            assert r["q2"] is None or r["q2"] == "—"
            assert r["q3"] is None or r["q3"] == "—"
            assert r["q4"] is None or r["q4"] == "—"

    print(f"   - Verified Participants Checked: {participants_checked} (Formula `Solved === Q1+Q2+Q3+Q4` satisfied for 100%)")
    print(f"   - Non-Participants / Unresolved Checked: {non_participants_checked} (All preserved as NULL/—, 0 fabricated questions)")
    print("   [PASS] Absolute Question Authenticity Rule verified.")

    # 4. Multi-Sheet Excel Export Integrity
    print(f"\n4. MULTI-SHEET EXCEL EXPORT VERIFICATION:")
    excel_bytes = export_excel_from_dataset(dataset)
    import io
    wb = openpyxl.load_workbook(io.BytesIO(excel_bytes), data_only=True)
    sheet_names = wb.sheetnames
    print(f"   - Generated Workbook Sheets ({len(sheet_names)}): {', '.join(sheet_names)}")
    
    assert "Executive Summary" in sheet_names or "Weekly Contest Summary" in sheet_names
    assert "Complete Student Roster" in sheet_names or "Student Performance" in sheet_names
    assert "Contest Attendance" in sheet_names or "Public Attended" in sheet_names
    
    ws_perf = wb["Complete Student Roster"] if "Complete Student Roster" in sheet_names else wb["Student Performance"]
    # Count rows with integer S.No
    excel_perf_rows = sum(1 for row_idx in range(1, ws_perf.max_row + 1) if isinstance(ws_perf.cell(row=row_idx, column=1).value, int))
    print(f"   - Excel 'Student Performance' Sheet Data Row Count: {excel_perf_rows}")
    assert excel_perf_rows == total_master, f"Excel data rows ({excel_perf_rows}) does not match Master Count ({total_master})"
    print("   [PASS] UI <-> Excel 1:1 Row Count Parity verified.")

    # 5. MASTER RULE INVARIANT: 4 Mutually Exclusive Categories, Zero Overlap
    print(f"\n5. MASTER RULE INVARIANT ASSERTIONS:")
    sc = dataset["statusCounts"]
    pub_c = sc.get("PUBLIC", 0)
    vir_c = sc.get("VIRTUAL", 0)
    na_c = sc.get("NOT_ATTENDED", 0)
    de_c = sc.get("DATA_ERROR", 0)
    invariant_sum = pub_c + vir_c + na_c + de_c
    print(f"   - PUBLIC={pub_c}  VIRTUAL={vir_c}  NOT_ATTENDED={na_c}  DATA_ERROR={de_c}")
    print(f"   - Sum = {invariant_sum}  |  TOTAL_STUDENTS = {total_master}")
    assert invariant_sum == total_master, f"INVARIANT FAILED: {invariant_sum} != {total_master}"

    # Set disjointness
    pub_ids = set(r["student_id"] for r in all_rows if r["status"] == "PUBLIC")
    vir_ids = set(r["student_id"] for r in all_rows if r["status"] == "VIRTUAL")
    na_ids = set(r["student_id"] for r in all_rows if r["status"] == "NOT_ATTENDED")
    de_ids = set(r["student_id"] for r in all_rows if r["status"] == "DATA_ERROR")
    assert pub_ids.isdisjoint(vir_ids), "PUBLIC ∩ VIRTUAL ≠ ∅"
    assert pub_ids.isdisjoint(na_ids), "PUBLIC ∩ NOT_ATTENDED ≠ ∅"
    assert pub_ids.isdisjoint(de_ids), "PUBLIC ∩ DATA_ERROR ≠ ∅"
    assert vir_ids.isdisjoint(na_ids), "VIRTUAL ∩ NOT_ATTENDED ≠ ∅"
    assert vir_ids.isdisjoint(de_ids), "VIRTUAL ∩ DATA_ERROR ≠ ∅"
    assert na_ids.isdisjoint(de_ids), "NOT_ATTENDED ∩ DATA_ERROR ≠ ∅"
    print("   [PASS] All 6 disjointness assertions passed (zero overlap).")
    print(f"   [PASS] TOTAL_STUDENTS == PUBLIC + VIRTUAL + NOT_ATTENDED + DATA_ERROR")

    # 6. Evidence completeness for participants
    print(f"\n6. EVIDENCE COMPLETENESS CHECK:")
    missing_ev = [r for r in all_rows if r["status"] in ("PUBLIC","VIRTUAL") and not r.get("evidence_source")]
    print(f"   - Participants missing evidence_source: {len(missing_ev)}")
    assert len(missing_ev) == 0, f"{len(missing_ev)} participants lack evidence_source"
    print("   [PASS] 100% of PUBLIC/VIRTUAL students have evidence_source attached.")

    print("\n================================================================================")
    print(">>> AUDIT RESULT: 100% RECONCILIATION & DATA ACCURACY PASSED SUCCESSFULLY! <<<")
    print("================================================================================\n")

if __name__ == "__main__":
    run_full_accuracy_audit()
