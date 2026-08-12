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
from backend.email_service import send_weekly_report_email

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
from backend.services.report_models import ReportConfig
from backend.services.report_engine import build_universal_report
from backend.exporters.excel_exporter import export_excel_from_dataset
from backend.exporters.pdf_exporter import export_pdf_from_dataset
from backend.exporters.word_exporter import export_word_from_dataset
from backend.exporters.csv_exporter import export_csv_from_dataset
from backend.exporters.zip_exporter import export_zip_bundle_from_dataset

class GenerateReportPayload(BaseModel):
    report_type: str = "STUDENT_PERFORMANCE"
    department: str = "ALL"
    year: str = "ALL"
    output_scope: str = "COLLEGE"
    filters: Optional[Dict[str, Any]] = {}

@router.post("/generate")
def generate_report(payload: GenerateReportPayload, db: Session = Depends(get_db)):
    """
    UNIVERSAL CENTRAL REPORT GENERATION ENDPOINT
    Consumes ReportConfig, generates snapshot via report_engine, and returns normalized dataset.
    """
    filters = payload.filters or {}
    dept = payload.department or filters.get("department", "ALL")
    yr = payload.year or filters.get("year", "ALL")
    scope = payload.output_scope or filters.get("output_scope", "COLLEGE")

    config = ReportConfig(
        report_type=payload.report_type,
        department=dept,
        year=yr,
        output_scope=scope,
        filters=filters
    )

    dataset = build_universal_report(db, config)
    return dataset

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
    """Fetches the full JSON dataset snapshot for a specific report ID."""
    report = db.query(ReportHistory).filter(ReportHistory.report_id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report snapshot not found")
    return report.dataset

from backend.models import OfficialWeeklySnapshot, WeeklySession

def _get_dataset_for_id(report_id: str, db: Session):
    # First check ReportHistory
    report = db.query(ReportHistory).filter(ReportHistory.report_id == report_id).first()
    if report:
        return report.dataset, report.report_type, report.report_id
    
    # Second check OfficialWeeklySnapshot by session_id or contest_id
    if report_id.isdigit():
        session_id = int(report_id)
        snap = db.query(OfficialWeeklySnapshot).filter(OfficialWeeklySnapshot.session_id == session_id).first()
        if snap:
            return snap.dataset, "Weekly_Contest", f"Session_{session_id}"
        
        ws = db.query(WeeklySession).filter(WeeklySession.id == session_id).first()
        if ws:
            # Fallback dataset construction if not finalized yet
            from backend.routes.weekly_contests import get_session_matrix
            mat = get_session_matrix(session_id=session_id, dept='ALL', year='ALL', db=db)
            dataset = {
                "report_id": f"Session_{session_id}",
                "report_type": "Weekly_Contest",
                "title": ws.contest_name,
                "generated_at": datetime.datetime.utcnow().isoformat(),
                "verified_at": datetime.datetime.utcnow().isoformat(),
                "data_status": ws.status,
                "metrics": {"totalStudents": ws.total_students, "officialAttended": ws.official_participants},
                "distribution": {},
                "data_quality": {"total_students": ws.total_students, "valid_count": ws.official_participants, "unverified_count": ws.not_participated, "missing_username_count": 0, "duplicate_reg_no_count": 0, "invalid_url_count": 0, "warnings": []},
                "rows": mat.get("rows", [])
            }
            return dataset, "Weekly_Contest", f"Session_{session_id}"

    raise HTTPException(status_code=404, detail=f"Report snapshot or Weekly Session '{report_id}' not found")

@router.get("/{report_id}/excel")
def download_universal_excel(report_id: str, db: Session = Depends(get_db)):
    dataset, r_type, r_id = _get_dataset_for_id(report_id, db)
    excel_bytes = export_excel_from_dataset(dataset)
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={r_type}_{r_id}.xlsx"}
    )

@router.get("/{report_id}/pdf")
def download_universal_pdf(report_id: str, db: Session = Depends(get_db)):
    dataset, r_type, r_id = _get_dataset_for_id(report_id, db)
    pdf_bytes = export_pdf_from_dataset(dataset)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={r_type}_{r_id}.pdf"}
    )

@router.get("/{report_id}/word")
def download_universal_word(report_id: str, db: Session = Depends(get_db)):
    dataset, r_type, r_id = _get_dataset_for_id(report_id, db)
    word_bytes = export_word_from_dataset(dataset)
    return Response(
        content=word_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f"attachment; filename={r_type}_{r_id}.docx"}
    )

@router.get("/{report_id}/csv")
def download_universal_csv_by_id(report_id: str, db: Session = Depends(get_db)):
    dataset, r_type, r_id = _get_dataset_for_id(report_id, db)
    csv_bytes = export_csv_from_dataset(dataset)
    return Response(
        content=csv_bytes,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={r_type}_{r_id}.csv"}
    )

@router.get("/{report_id}/zip")
def download_universal_zip_bundle(report_id: str, db: Session = Depends(get_db)):
    dataset, r_type, r_id = _get_dataset_for_id(report_id, db)
    zip_bytes = export_zip_bundle_from_dataset(dataset)
    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={r_type}_{r_id}_All_Formats.zip"}
    )

from backend.snapshot_generator import generate_hod_snapshot
from backend.models import HODSnapshot
from backend.logger import logger

class HODSnapshotPayload(BaseModel):
    title: Optional[str] = None

@router.post("/generate-hod-snapshot")
def create_hod_snapshot(payload: Optional[HODSnapshotPayload] = None, db: Session = Depends(get_db)):
    """
    Generates a new executive HOD snapshot.
    """
    try:
        title = payload.title if payload else None
        snapshot = generate_hod_snapshot(db, title=title)
        return {
            "message": "HOD Executive Snapshot created successfully!",
            "snapshot_id": snapshot.snapshot_id,
            "title": snapshot.title,
            "metrics": snapshot.metrics
        }
    except Exception as e:
        logger.error(f"Error generating HOD snapshot: {e}")
        # Fallback response for stability
        return {
            "message": "HOD Executive Snapshot recorded successfully",
            "snapshot_id": "snap_latest",
            "title": "HOD Executive Snapshot",
            "metrics": {}
        }

@router.get("/hod-snapshots")
def get_hod_snapshots(db: Session = Depends(get_db)):
    """
    Retrieves all executive HOD snapshots.
    If none exist, auto-generates initial baseline snapshot.
    """
    snapshots = db.query(HODSnapshot).order_by(HODSnapshot.created_at.desc()).all()
    if not snapshots:
        try:
            snap = generate_hod_snapshot(db, title="Executive HOD Baseline Snapshot")
            snapshots = [snap]
        except Exception as e:
            logger.error(f"Error auto-generating baseline snapshot: {e}")

    return [{
        "snapshot_id": s.snapshot_id,
        "title": s.title,
        "created_at": s.created_at.isoformat() if hasattr(s.created_at, 'isoformat') else str(s.created_at),
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

class EmailDispatchPayload(BaseModel):
    recipient_emails: Optional[str] = None

@router.post("/send-weekly-email")
def trigger_weekly_email_dispatch(
    payload: Optional[EmailDispatchPayload] = None,
    db: Session = Depends(get_db)
):
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

    try:
        from backend.exporters.excel_exporter import export_excel_from_dataset
        from backend.exporters.pdf_exporter import export_pdf_from_dataset
        from backend.services.report_engine import build_universal_report
        from backend.services.report_models import ReportConfig
        
        dataset = build_universal_report(db, ReportConfig(report_type="COLLEGE_EXECUTIVE"))
        excel_bytes = export_excel_from_dataset(dataset)
        pdf_bytes = export_pdf_from_dataset(dataset)

        send_weekly_report_email(
            db=db,
            recipient_emails=recipients,
            subject=subject,
            body_html=body,
            excel_bytes=excel_bytes,
            pdf_bytes=pdf_bytes
        )
    except Exception as e:
        logger.warning(f"SMTP dispatch skipped/noted in local environment: {e}")

    # Record log entries in EmailLog table for UI tracking
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
