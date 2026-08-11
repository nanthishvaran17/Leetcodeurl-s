import csv
import io
import datetime
from fastapi import APIRouter, Depends, Response, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

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

@router.get("/export-csv")
def download_csv_report(dept_id: Optional[int] = None, year_level: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Student).filter(Student.is_active == True)
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
        "Hard Solved", "Total Solved", "Contest Rating", "Global Rank"
    ])
    
    sorted_students = sorted(students, key=lambda s: (s.stats.total_solved if s.stats else 0), reverse=True)
    for idx, s in enumerate(sorted_students, start=1):
        st = s.stats
        writer.writerow([
            idx,
            s.reg_no,
            s.name,
            s.department.code if s.department else "",
            s.year_level,
            s.leetcode_url or "",
            s.username or "",
            st.easy_solved if st else 0,
            st.medium_solved if st else 0,
            st.hard_solved if st else 0,
            st.total_solved if st else 0,
            round(st.contest_rating, 1) if st and st.contest_rating else "",
            st.contest_global_ranking if st and st.contest_global_ranking else ""
        ])
        
    csv_bytes = output.getvalue().encode('utf-8-sig') # UTF-8 BOM for Excel compatibility
    return Response(
        content=csv_bytes,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=LeetCode_Student_Performance_Report.csv"}
    )


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

from backend.email_service import send_weekly_report_email

@router.post("/send-weekly-email")
def trigger_weekly_email_dispatch(db: Session = Depends(get_db)):
    excel_bytes = generate_8_sheet_excel_report(db)
    matrix_bytes = generate_weekly_contest_matrix_excel(db, batch_label="2028")
    pdf_bytes = generate_pdf_summary_report(db)

    recipients = [e.strip() for e in settings.REPORT_RECIPIENT_EMAILS.split(",") if e.strip()]
    if not recipients:
        raise HTTPException(status_code=400, detail="No recipient emails configured in environment settings.")

    import datetime
    subject = f"Weekly LeetCode Performance Report - {datetime.date.today().strftime('%d.%m.%Y')}"
    body = f"""
    <h2>Nandha Engineering College - LeetCode Weekly Performance Report</h2>
    <p>Dear Faculty / HOD / Coordinator,</p>
    <p>Please find attached the latest weekly LeetCode performance report workbooks, contest matrix, and executive PDF summary.</p>
    <br/>
    <p>Regards,<br/><b>LeetCode Automated Platform</b></p>
    """

    send_weekly_report_email(
        db=db,
        recipient_emails=recipients,
        subject=subject,
        body_html=body,
        excel_bytes=excel_bytes,
        pdf_bytes=pdf_bytes
    )

    return {"message": f"Weekly report email successfully dispatched to {len(recipients)} recipients ({', '.join(recipients)})."}

@router.get("/email-logs")
def get_email_logs(db: Session = Depends(get_db)):
    logs = db.query(EmailLog).order_by(EmailLog.id.desc()).limit(100).all()
    return logs
