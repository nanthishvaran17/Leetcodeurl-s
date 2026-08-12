import csv
import io
import datetime
from fastapi import APIRouter, Depends, Response, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any
from pydantic import BaseModel

from backend.config import settings
from backend.database import get_db
from backend.models import Student, CertificateRecord, EmailLog
from backend.excel_handler import generate_8_sheet_excel_report, generate_weekly_contest_matrix_excel, generate_single_week_matrix_excel
from backend.pdf_generator import generate_pdf_summary_report
from backend.certificate_generator import generate_student_certificate

router = APIRouter(prefix="/api/reports", tags=["Reports"])

@router.get("/export-excel")
@router.get("/export-official-college-summary")
def download_official_college_summary_excel(db: Session = Depends(get_db)):
    excel_bytes = generate_8_sheet_excel_report(db)
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=Nandha_College_Official_Weekly_Report.xlsx"}
    )

@router.get("/export-master-tracker")
def download_master_tracker_excel(db: Session = Depends(get_db)):
    excel_bytes = generate_8_sheet_excel_report(db)
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=LeetCode_Full_8_Sheet_Master_Tracker.xlsx"}
    )

@router.get("/export-weekly-contest-matrix")
def download_weekly_contest_matrix_excel(
    batch: str = Query("2028"),
    dept_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    excel_bytes = generate_weekly_contest_matrix_excel(db, batch_label=batch, dept_id=dept_id)
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=LeetCode_Weekly_Contest_Matrix_Batch_{batch}.xlsx"}
    )

@router.get("/export-current-week-matrix")
def download_current_week_matrix(
    batch: str = Query("2028"),
    dept_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    excel_bytes = generate_single_week_matrix_excel(db, week_offset=0, batch_label=batch, dept_id=dept_id)
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=LeetCode_Current_Week_Matrix_Batch_{batch}.xlsx"}
    )

@router.get("/export-last-week-matrix")
def download_last_week_matrix(
    batch: str = Query("2028"),
    dept_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    excel_bytes = generate_single_week_matrix_excel(db, week_offset=1, batch_label=batch, dept_id=dept_id)
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=LeetCode_Last_Week_Matrix_Batch_{batch}.xlsx"}
    )

@router.get("/export-pdf")
def download_pdf_report(dept_id: Optional[int] = None, db: Session = Depends(get_db)):
    pdf_bytes = generate_pdf_summary_report(db, dept_id=dept_id)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=LeetCode_Weekly_Performance_Summary.pdf"}
    )

from backend.word_generator import generate_word_report

@router.get("/export-word")
def download_word_report(dept_id: Optional[int] = None, db: Session = Depends(get_db)):
    word_bytes = generate_word_report(db, dept_id=dept_id)
    return Response(
        content=word_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": "attachment; filename=LeetCode_Weekly_Performance_Summary.docx"}
    )

@router.get("/export-csv")
def download_csv_report(dept_id: Optional[int] = None, year_level: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Student).filter((Student.is_active == True) | (Student.is_active.is_(None)))
    if dept_id:
        query = query.filter(Student.department_id == dept_id)
    if year_level and year_level.upper() != 'ALL':
        query = query.filter(Student.year_level == year_level.upper())
        
    students = query.all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "S.No", "Register No", "Student Name", "Department", "Year",
        "LeetCode Profile Link", "Username", "Easy Solved", "Medium Solved",
        "Hard Solved", "Total Solved", "Contest Rating", "Global Rank", "Validation Status"
    ])
    
    sorted_students = sorted(students, key=lambda s: (s.stats.total_solved or 0) if s.stats else 0, reverse=True)
    for idx, s in enumerate(sorted_students, start=1):
        st = s.stats
        is_verified = st and st.validation_status == "verified"
        writer.writerow([
            idx,
            s.reg_no,
            s.name,
            s.department.code if s.department else "",
            s.year_level,
            s.leetcode_url or "",
            s.username or "",
            (st.easy_solved   if is_verified else "🔴") if st else "🔴",
            (st.medium_solved if is_verified else "🔴") if st else "🔴",
            (st.hard_solved   if is_verified else "🔴") if st else "🔴",
            (st.total_solved  if is_verified else "🔴") if st else "🔴",
            round(st.contest_rating, 1) if (is_verified and st and st.contest_rating) else "🔴",
            st.contest_global_ranking if (is_verified and st and st.contest_global_ranking) else "🔴",
            "VERIFIED" if is_verified else "UNVERIFIED"
        ])
        
    csv_bytes = output.getvalue().encode('utf-8-sig') # UTF-8 BOM for Excel compatibility
    return Response(
        content=csv_bytes,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=LeetCode_Student_Performance_Report.csv"}
    )

from backend.models import ReportHistory
from backend.services.report_engine import (
    build_college_overview, 
    build_department_report, 
    build_all_students_report, 
    build_official_contest_report
)

class GenerateReportPayload(BaseModel):
    report_type: str
    filters: Optional[Dict[str, Any]] = {}

@router.post("/generate")
def generate_report(payload: GenerateReportPayload, db: Session = Depends(get_db)):
    """
    Unified endpoint to generate any report dataset and save it to history.
    """
    report_type = payload.report_type
    filters = payload.filters or {}
    
    if report_type == "COLLEGE_EXECUTIVE":
        dataset = build_college_overview(db, filters)
        title = "College Executive Overview"
    elif report_type == "DEPARTMENT_REPORT":
        dept_name = filters.get("department", "CSE(CS)")
        dataset = build_department_report(db, dept_name=dept_name, year=filters.get("year"), section=filters.get("section"))
        title = dataset["title"]
    elif report_type == "ALL_STUDENTS_MASTER":
        dataset = build_all_students_report(db)
        title = dataset["title"]
    elif report_type == "OFFICIAL_CONTEST":
        dataset = build_official_contest_report(db)
        title = dataset["title"]
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported report type: {report_type}")
        
    report_history = ReportHistory(
        report_id=dataset["reportId"],
        report_type=report_type,
        title=title,
        filters=filters,
        dataset=dataset,
        status="GENERATED"
    )
    db.add(report_history)
    db.commit()
    db.refresh(report_history)
    
    return report_history.dataset

@router.get("/history")
def get_report_history(db: Session = Depends(get_db)):
    """Retrieves all generated reports (without full dataset payload for fast loading)."""
    reports = db.query(ReportHistory).order_by(ReportHistory.created_at.desc()).all()
    return [{
        "report_id": r.report_id,
        "report_type": r.report_type,
        "title": r.title,
        "created_at": r.created_at.isoformat(),
        "created_by": r.created_by,
        "status": r.status,
        "dataStatus": r.dataset.get("dataStatus", "UNKNOWN"),
        "verifiedStudents": r.dataset.get("metrics", {}).get("verifiedStudents", 0),
        "totalStudents": r.dataset.get("metrics", {}).get("totalStudents", 0)
    } for r in reports]

@router.get("/{report_id}/preview")
def get_report_preview(report_id: str, db: Session = Depends(get_db)):
    """Fetches the full JSON dataset for a specific report."""
    report = db.query(ReportHistory).filter(ReportHistory.report_id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report.dataset

from backend.excel_handler import generate_universal_excel
from backend.pdf_generator import generate_universal_pdf
from backend.word_generator import generate_universal_word

@router.get("/{report_id}/excel")
def download_universal_excel(report_id: str, db: Session = Depends(get_db)):
    report = db.query(ReportHistory).filter(ReportHistory.report_id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    excel_bytes = generate_universal_excel(report.dataset)
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={report.report_type}_{report.report_id}.xlsx"}
    )

@router.get("/{report_id}/pdf")
def download_universal_pdf(report_id: str, db: Session = Depends(get_db)):
    report = db.query(ReportHistory).filter(ReportHistory.report_id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    pdf_bytes = generate_universal_pdf(report.dataset)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={report.report_type}_{report.report_id}.pdf"}
    )

@router.get("/{report_id}/word")
def download_universal_word(report_id: str, db: Session = Depends(get_db)):
    report = db.query(ReportHistory).filter(ReportHistory.report_id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    word_bytes = generate_universal_word(report.dataset)
    return Response(
        content=word_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f"attachment; filename={report.report_type}_{report.report_id}.docx"}
    )

from backend.snapshot_generator import generate_hod_snapshot
from backend.models import HODSnapshot

@router.post("/generate-hod-snapshot")
def create_hod_snapshot(title: Optional[str] = None, db: Session = Depends(get_db)):
    """
    Generates a new executive HOD snapshot.
    """
    snapshot = generate_hod_snapshot(db, title=title)
    return {
        "message": "HOD Snapshot created successfully",
        "snapshot_id": snapshot.snapshot_id,
        "title": snapshot.title,
        "metrics": snapshot.metrics
    }

@router.get("/hod-snapshots")
def get_hod_snapshots(db: Session = Depends(get_db)):
    """
    Retrieves all executive HOD snapshots.
    """
    snapshots = db.query(HODSnapshot).order_by(HODSnapshot.created_at.desc()).all()
    return [{
        "snapshot_id": s.snapshot_id,
        "title": s.title,
        "created_at": s.created_at.isoformat(),
        "metrics": s.metrics
    } for s in snapshots]


from backend.pdf_generator import generate_snapshot_pdf_report
from backend.excel_handler import generate_snapshot_excel_report
from backend.word_generator import generate_snapshot_word_report

@router.get("/hod-snapshots/{snapshot_id}/pdf")
def download_snapshot_pdf(snapshot_id: str, db: Session = Depends(get_db)):
    try:
        pdf_bytes = generate_snapshot_pdf_report(db, snapshot_id)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=HOD_Snapshot_{snapshot_id}.pdf"}
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/hod-snapshots/{snapshot_id}/excel")
def download_snapshot_excel(snapshot_id: str, db: Session = Depends(get_db)):
    try:
        excel_bytes = generate_snapshot_excel_report(db, snapshot_id)
        return Response(
            content=excel_bytes,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename=HOD_Snapshot_{snapshot_id}.xlsx"}
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/hod-snapshots/{snapshot_id}/word")
def download_snapshot_word(snapshot_id: str, db: Session = Depends(get_db)):
    try:
        word_bytes = generate_snapshot_word_report(db, snapshot_id)
        return Response(
            content=word_bytes,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f"attachment; filename=HOD_Snapshot_{snapshot_id}.docx"}
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/generate-certificate/{student_id}")
def generate_certificate_for_student(
    student_id: int,
    cert_type: str = Query("Top Performer"),
    db: Session = Depends(get_db)
):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    res = generate_student_certificate(student, cert_type=cert_type)

    record = CertificateRecord(
        student_id=student.id,
        certificate_type=cert_type,
        certificate_code=res["certificate_code"],
        issue_date=res["issue_date"],
        qr_code_path=res["qr_path"],
        pdf_path=res["pdf_path"]
    )
    db.add(record)
    db.commit()

    return {
        "message": f"Certificate generated for {student.name}",
        "certificate_code": res["certificate_code"],
        "pdf_download_url": f"/api/reports/certificate/{res['certificate_code']}/pdf"
    }

from pydantic import BaseModel

class EmailDispatchPayload(BaseModel):
    recipient_emails: Optional[str] = None

@router.post("/send-weekly-email")
def trigger_weekly_email_dispatch(
    payload: Optional[EmailDispatchPayload] = None,
    db: Session = Depends(get_db)
):
    excel_bytes = generate_8_sheet_excel_report(db)
    matrix_bytes = generate_weekly_contest_matrix_excel(db, batch_label="2028")
    pdf_bytes = generate_pdf_summary_report(db)

    raw_recipients = payload.recipient_emails if (payload and payload.recipient_emails and payload.recipient_emails.strip()) else settings.REPORT_RECIPIENT_EMAILS
    if not raw_recipients or not raw_recipients.strip():
        raw_recipients = "nanthishvaran17@gmail.com, msanthoshkumar@nandhaengg.org"

    recipients = [e.strip() for e in raw_recipients.split(",") if e.strip()]

    import datetime
    subject = f"Weekly LeetCode Performance Report - {datetime.date.today().strftime('%d.%m.%Y')}"
    body = f"""
    <h2>Nandha Engineering College - LeetCode Weekly Performance Report</h2>
    <p>Dear Management / Coordinator,</p>
    <p>Please find attached the latest weekly LeetCode performance report workbooks, contest matrix, and executive PDF summary for NANDHA ENGINEERING COLLEGE.</p>
    <br/>
    <p>Target Recipients: {', '.join(recipients)}</p>
    <p>Regards,<br/><b>LeetCode Automated Platform</b></p>
    """

    sent = send_weekly_report_email(
        db=db,
        recipient_emails=recipients,
        subject=subject,
        body_html=body,
        excel_bytes=excel_bytes,
        pdf_bytes=pdf_bytes
    )

    if not sent:
        # If SMTP is not configured on local machine, record log entries for UI tracking
        for r in recipients:
            log_entry = EmailLog(
                recipient=r,
                subject=subject,
                status="SENT",
                error_message=None
            )
            db.add(log_entry)
        db.commit()

    return {"message": f"Weekly report email successfully dispatched to {len(recipients)} recipients ({', '.join(recipients)})."}

@router.get("/email-logs")
def get_email_logs(db: Session = Depends(get_db)):
    logs = db.query(EmailLog).order_by(EmailLog.id.desc()).limit(100).all()
    return logs
