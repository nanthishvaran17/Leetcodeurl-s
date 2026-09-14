import io
import re
import zipfile
from backend.exporters.excel_exporter import export_excel_from_dataset
from backend.exporters.pdf_exporter import export_pdf_from_dataset
from backend.exporters.word_exporter import export_word_from_dataset
from backend.exporters.csv_exporter import export_csv_from_dataset

def export_zip_bundle_from_dataset(dataset: dict) -> bytes:
    """
    CANONICAL INSTITUTIONAL ZIP BUNDLE EXPORTER
    Packs all 4 institutional formats (Excel .xlsx, PDF .pdf, Word .docx, CSV .csv)
    plus executive summary text file into a single compressed ZIP archive.
    """
    contest_name = dataset.get("contestName") or dataset.get("title", "")
    session_date = dataset.get("sessionDate") or dataset.get("session_date") or ""
    dept = dataset.get("department") or dataset.get("dept") or "ALL"
    year = dataset.get("year") or dataset.get("year_level") or "ALL"
    
    try:
        from backend.routes.reports import get_contest_filename_base
        filename_base = get_contest_filename_base(contest_name, session_date, dept, year)
    except Exception:
        match = re.search(r'\d+', str(contest_name))
        if match:
            filename_base = f"NEC_WC{match.group(0)}"
        else:
            report_id = dataset.get("reportId", "REPORT")
            filename_base = f"NEC_Report_{report_id}"

    excel_bytes = export_excel_from_dataset(dataset)
    pdf_bytes = export_pdf_from_dataset(dataset)
    word_bytes = export_word_from_dataset(dataset)
    csv_bytes = export_csv_from_dataset(dataset)

    # Executive Metrics Summary
    metrics = dataset.get("metrics", {})
    rows = dataset.get("rows", [])
    tot_students = len(rows) if len(rows) > 0 else metrics.get("totalStudents", 0)
    tot_attended = sum(1 for r in rows if r.get("participation_status") in ("PUBLIC_ATTENDED", "OFFICIAL_ATTENDED", "ATTENDED", "PUBLIC"))
    tot_not_attended = sum(1 for r in rows if r.get("participation_status") in ("PUBLIC_NOT_ATTENDED", "NOT_ATTENDED"))
    tot_data_errors = sum(1 for r in rows if r.get("participation_status") in ("USERNAME_NOT_FOUND", "DATA_ERROR"))
    att_pct = (tot_attended / tot_students * 100) if tot_students > 0 else 0.0

    tot_platform_solved = sum(int(float(str(r.get("total_solved") or 0))) for r in rows if str(r.get("total_solved", "")).replace(".","").isdigit())

    summary_text = (
        f"=================================================================\n"
        f"NANDHA ENGINEERING COLLEGE (AUTONOMOUS) - LEETCODE INTELLIGENCE\n"
        f"INSTITUTIONAL REPORT BUNDLE MANIFEST\n"
        f"=================================================================\n\n"
        f"Contest / Session: {contest_name}\n"
        f"Session Date:      {session_date}\n"
        f"Report ID:         {dataset.get('snapshotId') or dataset.get('reportId', 'N/A')}\n"
        f"Department Filter: {dept}\n"
        f"Year Filter:       {year}\n"
        f"Generated At:      {dataset.get('generatedAtIST') or dataset.get('generatedAt', 'N/A')}\n\n"
        f"-----------------------------------------------------------------\n"
        f"EXECUTIVE METRICS SUMMARY\n"
        f"-----------------------------------------------------------------\n"
        f"Total Active Students: {tot_students}\n"
        f"Official Attended:     {tot_attended} ({att_pct:.1f}%)\n"
        f"Not Attended:          {tot_not_attended}\n"
        f"Data Errors (Unfound): {tot_data_errors}\n"
        f"Cumulative Solves:     {tot_platform_solved:,}\n\n"
        f"-----------------------------------------------------------------\n"
        f"INCLUDED ARCHIVE FILES\n"
        f"-----------------------------------------------------------------\n"
        f"1. {filename_base}.xlsx (Master 8-Sheet Institutional Excel Workbook)\n"
        f"2. {filename_base}.pdf  (Premium Dynamic-Paginated Multi-Page PDF Report)\n"
        f"3. {filename_base}.docx (Editable Premium Microsoft Word Intelligence Document)\n"
        f"4. {filename_base}.csv  (Raw Filtered Student Performance Dataset)\n"
        f"5. README_MANIFEST.txt (Institutional Audit & Summary Manifest)\n\n"
        f"=================================================================\n"
        f"Nandha Engineering College, Erode – 638 052 | Confidential Record\n"
        f"=================================================================\n"
    )

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(f"{filename_base}.xlsx", excel_bytes)
        zf.writestr(f"{filename_base}.pdf", pdf_bytes)
        zf.writestr(f"{filename_base}.docx", word_bytes)
        zf.writestr(f"{filename_base}.csv", csv_bytes)
        zf.writestr("README_MANIFEST.txt", summary_text.encode('utf-8'))

    zip_buffer.seek(0)
    return zip_buffer.getvalue()


def export_student_zip_bundle_from_dataset(dataset: dict, student_name: str, reg_no: str, prefix: str) -> bytes:
    """
    Creates a ZIP bundle with only the PDF and Excel file for a single student.
    """
    from backend.exporters.student_excel_exporter import export_student_excel_from_dataset
    from backend.exporters.student_pdf_exporter import export_student_pdf_from_dataset
    
    excel_bytes = export_student_excel_from_dataset(dataset, prefix)
    pdf_bytes = export_student_pdf_from_dataset(dataset, prefix)
    
    safe_name = student_name.replace(" ", "_").replace("/", "_")
    safe_reg = reg_no.replace(" ", "_")
    base_name = f"Nandha_{prefix}_{safe_name}_{safe_reg}"

    summary_text = (
        f"=================================================================\n"
        f"NANDHA ENGINEERING COLLEGE (AUTONOMOUS) - STUDENT INTELLIGENCE\n"
        f"STUDENT REPORT BUNDLE MANIFEST\n"
        f"=================================================================\n\n"
        f"Student Name:      {student_name}\n"
        f"Register No:       {reg_no}\n"
        f"Generated At:      {dataset.get('generatedAtIST') or dataset.get('generatedAt', 'N/A')}\n\n"
        f"-----------------------------------------------------------------\n"
        f"INCLUDED ARCHIVE FILES\n"
        f"-----------------------------------------------------------------\n"
        f"1. {base_name}.xlsx\n"
        f"2. {base_name}.pdf\n"
        f"3. README_MANIFEST.txt\n\n"
        f"=================================================================\n"
    )

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(f"{base_name}.xlsx", excel_bytes)
        zf.writestr(f"{base_name}.pdf", pdf_bytes)
        zf.writestr("README_MANIFEST.txt", summary_text.encode('utf-8'))

    zip_buffer.seek(0)
    return zip_buffer.getvalue()
