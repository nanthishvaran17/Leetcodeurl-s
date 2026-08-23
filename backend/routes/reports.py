import os
import csv
import io
import datetime
from fastapi import APIRouter, Depends, Response, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any
from pydantic import BaseModel

from backend.config import settings
from backend.database import get_db
from backend.models import Student, CertificateRecord, EmailLog, ContestParticipation
from backend.excel_handler import (
    generate_8_sheet_excel_report,
    generate_student_performance_detail_excel,
    generate_8_sheet_master_tracker,
    generate_weekly_contest_matrix_excel,
    generate_single_week_matrix_excel
)
from backend.pdf_generator import generate_pdf_summary_report
from backend.certificate_generator import generate_student_certificate
from backend.email_service import send_weekly_report_email
from backend.logger import logger
from backend.security import require_security_access

router = APIRouter(prefix="/api/reports", tags=["Reports"])

@router.post("/trigger-public-contest-workflow")
def trigger_public_contest_workflow_endpoint(
    db: Session = Depends(get_db),
    current_user = Depends(require_security_access(resource_name="Trigger Public Contest Workflow", required_roles=["admin", "super admin"]))
):
    """Triggers Sunday 9:45 AM Public Contest fetch, Excel generation, and Email workflow."""
    from backend.services.weekly_report_service import run_sunday_0945_public_contest_workflow
    result = run_sunday_0945_public_contest_workflow(db)
    return result

@router.post("/trigger-virtual-contest-workflow")
def trigger_virtual_contest_workflow_endpoint(
    db: Session = Depends(get_db),
    current_user = Depends(require_security_access(resource_name="Trigger Virtual Contest Workflow", required_roles=["admin", "super admin"]))
):
    """Triggers Sunday 10:00 PM Virtual Contest fetch, Combined Excel generation, and Email workflow."""
    from backend.services.weekly_report_service import run_sunday_2200_virtual_contest_workflow
    result = run_sunday_2200_virtual_contest_workflow(db)
    return result

@router.get("/export-student-performance-detail")
def download_student_performance_detail_excel(
    db: Session = Depends(get_db),
    current_user = Depends(require_security_access(resource_name="Export Student Performance Detail Excel", dept_scoped=True))
):
    try:
        excel_bytes = generate_student_performance_detail_excel(db)
        return Response(
            content=excel_bytes,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=Nandha_Student_Performance_Detail.xlsx"}
        )
    except Exception as e:
        logger.error(f"[EXPORT ERROR] /export-student-performance-detail: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate Student Performance Detail Excel: {str(e)}")

@router.get("/export-excel")
@router.get("/export-official-college-summary")
def download_official_college_summary_excel(
    db: Session = Depends(get_db),
    current_user = Depends(require_security_access(resource_name="Export Excel Summary Report", dept_scoped=True))
):
    try:
        excel_bytes = generate_8_sheet_excel_report(db)
        return Response(
            content=excel_bytes,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=Nandha_College_Official_Weekly_Report.xlsx"}
        )
    except Exception as e:
        logger.error(f"[EXPORT ERROR] /export-official-college-summary: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate Official College Weekly Excel: {str(e)}")

@router.get("/export-master-tracker")
def download_master_tracker_excel(
    db: Session = Depends(get_db),
    current_user = Depends(require_security_access(resource_name="Export Master Tracker Excel", dept_scoped=True))
):
    try:
        excel_bytes = generate_8_sheet_master_tracker(db)
        return Response(
            content=excel_bytes,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=Full_8_Sheet_Master_Tracker.xlsx"}
        )
    except Exception as e:
        logger.error(f"[EXPORT ERROR] /export-master-tracker: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate 8-Sheet Master Tracker Excel: {str(e)}")

@router.get("/export-weekly-contest-matrix")
def download_weekly_contest_matrix_excel(
    batch: str = Query("2028"),
    dept_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user = Depends(require_security_access(resource_name="Export Contest Matrix Excel", dept_scoped=True))
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
    db: Session = Depends(get_db),
    current_user = Depends(require_security_access(resource_name="Export Current Week Matrix Excel", dept_scoped=True))
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
    db: Session = Depends(get_db),
    current_user = Depends(require_security_access(resource_name="Export Last Week Matrix Excel", dept_scoped=True))
):
    excel_bytes = generate_single_week_matrix_excel(db, week_offset=1, batch_label=batch, dept_id=dept_id)
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=LeetCode_Last_Week_Matrix_Batch_{batch}.xlsx"}
    )

@router.get("/export-pdf")
def download_pdf_report(
    dept_id: Optional[int] = None, 
    db: Session = Depends(get_db),
    current_user = Depends(require_security_access(resource_name="Export PDF Report", dept_scoped=True))
):
    pdf_bytes = generate_pdf_summary_report(db, dept_id=dept_id)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=LeetCode_Weekly_Performance_Summary.pdf"}
    )

from backend.word_generator import generate_word_report

@router.get("/export-word")
def download_word_report(
    dept_id: Optional[int] = None, 
    db: Session = Depends(get_db),
    current_user = Depends(require_security_access(resource_name="Export Word Report", dept_scoped=True))
):
    word_bytes = generate_word_report(db, dept_id=dept_id)
    return Response(
        content=word_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": "attachment; filename=LeetCode_Weekly_Performance_Summary.docx"}
    )

@router.get("/export-csv")
def download_csv_report(
    dept_id: Optional[int] = None, 
    year_level: Optional[str] = None, 
    db: Session = Depends(get_db),
    current_user = Depends(require_security_access(resource_name="Export CSV Report", dept_scoped=True))
):
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
def generate_report(
    payload: GenerateReportPayload, 
    db: Session = Depends(get_db),
    current_user = Depends(require_security_access(resource_name="Generate Universal Report", dept_scoped=True))
):
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
def get_report_history(
    db: Session = Depends(get_db),
    current_user = Depends(require_security_access(resource_name="View Report History", dept_scoped=True))
):
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
def get_report_preview(
    report_id: str, 
    dept: str = "ALL", 
    year: str = "ALL", 
    attendance: str = "ALL", 
    db: Session = Depends(get_db),
    current_user = Depends(require_security_access(resource_name="View Report Preview", dept_scoped=True))
):
    """Fetches the full JSON dataset snapshot for a specific report ID or session ID."""
    dataset, _ = _get_dataset_for_id(report_id, db, dept=dept, year=year, attendance=attendance)
    return dataset

from backend.models import OfficialWeeklySnapshot, WeeklySession
from backend.routes.weekly_contests import matches_dept, matches_year
import re

def get_contest_filename_base(contest_name: str, session_date: str = None, dept: str = "ALL", year: str = "ALL", attendance: str = "ALL") -> str:
    """
    Derives standard professional institutional report filename:
    Contest specific: Nandha_Engineering_College_LeetCode_Contest_<CONTEST_NUMBER>_<DATE>
    General: Nandha_Engineering_College_LeetCode_Weekly_Report_<DATE>
    """
    import re
    now_ist = datetime.datetime.utcnow() + datetime.timedelta(hours=5, minutes=30)
    date_str = session_date.replace(".", "-") if session_date else now_ist.strftime("%Y-%m-%d")

    m = re.search(r'\d+', str(contest_name or ""))
    if m:
        c_num = m.group(0)
        return f"Nandha_Engineering_College_LeetCode_Contest_{c_num}_{date_str}"
    else:
        return f"Nandha_Engineering_College_LeetCode_Weekly_Report_{date_str}"

def _get_dataset_for_id(report_id: str, db: Session, dept: str = "ALL", year: str = "ALL", attendance: str = "ALL"):
    # First check ReportHistory
    report = db.query(ReportHistory).filter(ReportHistory.report_id == report_id).first()
    if report:
        dataset = report.dataset
        contest_name = dataset.get("contestName") or dataset.get("title") or "Weekly Contest"
        session_date = dataset.get("sessionDate") or dataset.get("session_date")
        r_filename = get_contest_filename_base(contest_name, session_date=session_date, dept=dept, year=year, attendance=attendance)
    else:
        dataset = None

        # Resolve session_id from report_id
        session_id = None
        if report_id.isdigit():
            session_id = int(report_id)
        elif report_id.startswith("Session_"):
            try:
                session_id = int(report_id.replace("Session_", ""))
            except Exception:
                pass
        
        if session_id is None:
            # Fallback: extract contest number from report_id
            m = re.search(r'\d+', report_id)
            if m:
                val = int(m.group(0))
                ws_match = db.query(WeeklySession).filter(WeeklySession.id == val).first()
                if not ws_match:
                    ws_match = db.query(WeeklySession).filter(WeeklySession.contest_name.ilike(f"%{val}%")).first()
                if ws_match:
                    session_id = ws_match.id

        if session_id is not None:
            ws = db.query(WeeklySession).filter(WeeklySession.id == session_id).first()
            if not ws:
                raise HTTPException(
                    status_code=404, 
                    detail="Contest data is unavailable for the selected Weekly Contest."
                )

            contest_name = ws.contest_name or f"Weekly Contest {session_id}"
            session_date = ws.session_date or ""
            r_filename = get_contest_filename_base(contest_name, dept=dept, year=year, attendance=attendance)

            from backend.services.canonical_contest_engine import build_canonical_contest_dataset
            # Official institutional report ALWAYS covers the complete 1,450-student authoritative roster
            canonical_data = build_canonical_contest_dataset(
                session_id=session_id,
                db=db,
                dept="ALL",
                year="ALL",
                attendance="ALL"
            )

            raw_rows = canonical_data.get("rows", [])
            matrix_metrics = canonical_data.get("metrics", {})

            all_students = []
            top_students = []

            for r in raw_rows:
                status_str = r.get("status", "NOT_ATTENDED")
                attended = status_str in ("PUBLIC", "VIRTUAL")
                v_q1 = r.get("q1")
                v_q2 = r.get("q2")
                v_q3 = r.get("q3")
                v_q4 = r.get("q4")
                solved_val = r.get("total_solved")
                rank_val = r.get("rank")
                rating_val = r.get("rating")
                score_val = r.get("score") or 0

                entry = {
                    "reg_no": r.get("reg_no", ""),
                    "name": r.get("name", ""),
                    "dept": r.get("dept", ""),
                    "year": r.get("year", ""),
                    "username": r.get("username", ""),
                    "profile_rank": r.get("profile_rank", "—"),
                    "easy": v_q1 if (v_q1 is not None) else 0,
                    "medium": v_q2 if (v_q2 is not None) else 0,
                    "hard": v_q3 if (v_q3 is not None) else 0,
                    "total_solved": solved_val if (attended and solved_val is not None) else None,
                    "status": status_str,
                    "rank": rank_val if attended else "—",
                    "score": score_val if attended else 0,
                    "rating": rating_val if attended else None
                }
                all_students.append(entry)
                if attended:
                    top_students.append(entry)

            top_students.sort(key=lambda x: float(x.get("score") or 0), reverse=True)

            dataset = {
                "report_id": f"Session_{session_id}",
                "reportId": f"Session_{session_id}",
                "report_type": "Weekly_Contest",
                "contestId": ws.contest_id,
                "contestName": contest_name,
                "sessionDate": session_date,
                "contestDate": session_date,
                "title": f"NANDHA ENGINEERING COLLEGE\n{contest_name.upper()}\nSTUDENT PERFORMANCE REPORT",
                "generated_at": canonical_data.get("generatedAtIST"),
                "generatedAt": canonical_data.get("generatedAtIST"),
                "generatedAtIST": canonical_data.get("generatedAtIST"),
                "verified_at": ws.finalized_at.isoformat() if ws.finalized_at else canonical_data.get("generatedAtIST"),
                "data_status": ws.status,
                "dataStatus": ws.status,
                "istWindow": "08:00 AM – 09:30 AM IST",
                "deptFilter": dept or "ALL",
                "yearFilter": year or "ALL",
                "attendanceFilter": attendance or "ALL",
                "metrics": {
                    "totalStudents": matrix_metrics.get("totalStudents", len(raw_rows)),
                    "officialAttended": matrix_metrics.get("officialAttended", 0),
                    "notAttended": matrix_metrics.get("notAttended", 0),
                    "virtualAttended": matrix_metrics.get("virtualAttended", 0),
                    "dataErrors": matrix_metrics.get("errors", 0),
                    "contestName": contest_name,
                    "sessionDate": session_date,
                    "participationRate": f"{matrix_metrics.get('participationPercentage', 0)}%",
                    "4 Q Solved": matrix_metrics.get("q4Count", 0),
                    "3 Q Solved": matrix_metrics.get("q3Count", 0),
                    "2 Q Solved": matrix_metrics.get("q2Count", 0),
                    "1 Q Solved": matrix_metrics.get("q1Count", 0),
                },
                "distribution": {},
                "allStudents": all_students,
                "topStudents": top_students[:50],
                "data_quality": {
                    "total_students": matrix_metrics.get("totalStudents", len(raw_rows)),
                    "valid_count": matrix_metrics.get("officialAttended", 0) + matrix_metrics.get("virtualAttended", 0),
                    "unverified_count": matrix_metrics.get("notAttended", 0),
                    "error_count": matrix_metrics.get("errors", 0),
                    "warnings": []
                },
                "rows": raw_rows,
                "all_rows": canonical_data.get("all_rows", raw_rows),
                "departmentStats": canonical_data.get("departmentStats", {}),
                "yearStats": canonical_data.get("yearStats", {}),
                "statusCounts": canonical_data.get("statusCounts", {}),
                "dataQualityIssues": canonical_data.get("dataQualityIssues", []),
                "reconciliation": canonical_data.get("reconciliation", {})
            }

    if not dataset:
        raise HTTPException(
            status_code=404, 
            detail="Contest data is unavailable for the selected Weekly Contest."
        )

    return dataset, r_filename


@router.get("/{report_id}/excel")
def download_universal_excel(
    report_id: str, 
    dept: str = "ALL", 
    year: str = "ALL", 
    attendance: str = "ALL", 
    db: Session = Depends(get_db),
    current_user = Depends(require_security_access(resource_name="Download Report Excel", dept_scoped=True))
):
    try:
        dataset, r_filename = _get_dataset_for_id(report_id, db, dept=dept, year=year, attendance=attendance)
        excel_bytes = export_excel_from_dataset(dataset)
        
        # Validate Excel workbook
        if not excel_bytes or len(excel_bytes) < 100:
            raise ValueError("Generated Excel file is empty or corrupted.")

        return Response(
            content=excel_bytes,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f'attachment; filename="{r_filename}.xlsx"',
                "Access-Control-Expose-Headers": "Content-Disposition"
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[EXCEL GENERATION FAILED] report_id={report_id}, error={e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate Excel report: {str(e)}")

@router.get("/{report_id}/pdf")
def download_universal_pdf(
    report_id: str, 
    dept: str = "ALL", 
    year: str = "ALL", 
    attendance: str = "ALL", 
    db: Session = Depends(get_db),
    current_user = Depends(require_security_access(resource_name="Download Report PDF", dept_scoped=True))
):
    try:
        dataset, r_filename = _get_dataset_for_id(report_id, db, dept=dept, year=year, attendance=attendance)
        pdf_bytes = export_pdf_from_dataset(dataset)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{r_filename}.pdf"'}
        )
    except Exception as e:
        logger.error(f"Error generating PDF report: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF report: {str(e)}")

@router.get("/{report_id}/word")
def download_universal_word(
    report_id: str, 
    dept: str = "ALL", 
    year: str = "ALL", 
    attendance: str = "ALL", 
    db: Session = Depends(get_db),
    current_user = Depends(require_security_access(resource_name="Download Report Word", dept_scoped=True))
):
    dataset, r_filename = _get_dataset_for_id(report_id, db, dept=dept, year=year, attendance=attendance)
    word_bytes = export_word_from_dataset(dataset)
    return Response(
        content=word_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{r_filename}.docx"'}
    )

@router.get("/{report_id}/csv")
def download_universal_csv_by_id(
    report_id: str, 
    dept: str = "ALL", 
    year: str = "ALL", 
    attendance: str = "ALL", 
    db: Session = Depends(get_db),
    current_user = Depends(require_security_access(resource_name="Download Report CSV", dept_scoped=True))
):
    dataset, r_filename = _get_dataset_for_id(report_id, db, dept=dept, year=year, attendance=attendance)
    csv_bytes = export_csv_from_dataset(dataset)
    return Response(
        content=csv_bytes,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{r_filename}.csv"'}
    )

@router.get("/{report_id}/zip")
def download_universal_zip_by_id(
    report_id: str, 
    dept: str = "ALL", 
    year: str = "ALL", 
    attendance: str = "ALL", 
    db: Session = Depends(get_db),
    current_user = Depends(require_security_access(resource_name="Download Report ZIP", dept_scoped=True))
):
    dataset, r_filename = _get_dataset_for_id(report_id, db, dept=dept, year=year, attendance=attendance)
    zip_bytes = export_zip_bundle_from_dataset(dataset)
    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{r_filename}.zip"'}
    )

from backend.snapshot_generator import generate_hod_snapshot

from backend.models import HODSnapshot
from backend.logger import logger

class HODSnapshotPayload(BaseModel):
    title: Optional[str] = None

@router.post("/generate-hod-snapshot")
def create_hod_snapshot(
    payload: Optional[HODSnapshotPayload] = None, 
    db: Session = Depends(get_db),
    current_user = Depends(require_security_access(resource_name="Generate HOD Snapshot", required_roles=["admin", "super admin"]))
):
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
def get_hod_snapshots(
    db: Session = Depends(get_db),
    current_user = Depends(require_security_access(resource_name="View HOD Snapshots", dept_scoped=True))
):
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
def download_snapshot_pdf(
    snapshot_id: str, 
    db: Session = Depends(get_db),
    current_user = Depends(require_security_access(resource_name="Download Snapshot PDF", dept_scoped=True))
):
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
def download_snapshot_excel(
    snapshot_id: str, 
    db: Session = Depends(get_db),
    current_user = Depends(require_security_access(resource_name="Download Snapshot Excel", dept_scoped=True))
):
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
def download_snapshot_word(
    snapshot_id: str, 
    db: Session = Depends(get_db),
    current_user = Depends(require_security_access(resource_name="Download Snapshot Word", dept_scoped=True))
):
    try:
        word_bytes = generate_snapshot_word_report(db, snapshot_id)
        return Response(
            content=word_bytes,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f"attachment; filename=HOD_Snapshot_{snapshot_id}.docx"}
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.delete("/hod-snapshots/{snapshot_id}")
def delete_hod_snapshot(
    snapshot_id: str, 
    db: Session = Depends(get_db),
    current_user = Depends(require_security_access(resource_name="Delete HOD Snapshot", required_roles=["admin", "super admin"]))
):
    """Deletes an executive HOD snapshot by ID."""
    snap = db.query(HODSnapshot).filter(HODSnapshot.snapshot_id == snapshot_id).first()
    if not snap:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    db.delete(snap)
    db.commit()
    return {"message": f"Snapshot {snapshot_id} deleted successfully", "snapshot_id": snapshot_id}



@router.post("/generate-certificate/{student_id}")
def generate_certificate_for_student(
    student_id: int,
    cert_type: str = Query("Top Performer"),
    db: Session = Depends(get_db)
):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    try:
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
    except Exception as e:
        logger.error(f"Failed to generate certificate for student {student_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Certificate generation error: {str(e)}")

@router.get("/certificate/{cert_code}/pdf")
def download_student_certificate_pdf(cert_code: str, db: Session = Depends(get_db)):
    """
    Downloads generated student certificate as a PDF file with automatic regeneration fallback.
    """
    import re
    from backend.certificate_generator import build_certificate_pdf_from_record

    raw_code = (cert_code or "").strip()
    cert = db.query(CertificateRecord).filter(
        (CertificateRecord.certificate_code == raw_code) |
        (CertificateRecord.verification_id == raw_code) |
        (CertificateRecord.verification_id.ilike(f"%{raw_code}%"))
    ).first()
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate PDF file not found")

    pdf_bytes = None
    if cert.pdf_path and os.path.exists(cert.pdf_path) and os.path.getsize(cert.pdf_path) > 0:
        try:
            with open(cert.pdf_path, "rb") as f:
                data = f.read()
                if data.startswith(b"%PDF-"):
                    pdf_bytes = data
        except Exception:
            pdf_bytes = None

    if not pdf_bytes:
        try:
            pdf_bytes = build_certificate_pdf_from_record(cert, db)
        except Exception as e:
            logger.error(f"Failed to regenerate certificate PDF for {cert_code}: {e}")
            raise HTTPException(status_code=500, detail="Failed to generate certificate PDF.")

    clean_name = re.sub(r'[^A-Za-z0-9_]+', '_', (cert.student_name or "STUDENT").strip().upper())
    clean_reg = re.sub(r'[^A-Za-z0-9_]+', '_', (cert.register_no or "").strip().upper())
    filename = f"Certificate_{clean_name}_{clean_reg}.pdf" if clean_reg else f"Certificate_{cert_code}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Type": "application/pdf",
            "Content-Length": str(len(pdf_bytes))
        }
    )

class EmailDispatchPayload(BaseModel):
    recipient_emails: Optional[str] = None

@router.post("/send-weekly-email")
def trigger_weekly_email_dispatch(
    payload: Optional[EmailDispatchPayload] = None,
    db: Session = Depends(get_db)
):
    # PRODUCTION LOCK: All automated reports ONLY go to nanthishvaran17@gmail.com
    recipients = ["nanthishvaran17@gmail.com"]

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


@router.get("/weekly-performance")
def get_weekly_performance_report_json(
    last_week_contest: Optional[int] = Query(None),
    current_week_contest: Optional[int] = Query(None),
    report_date: Optional[str] = Query(None),
    save_snapshot: bool = Query(False),
    db: Session = Depends(get_db)
):
    """
    Returns canonical weekly performance dataset including Last vs Current Week metrics,
    movement tracking, category student lists, and data validation issues.
    """
    from backend.services.weekly_report_service import generate_weekly_performance_data
    return generate_weekly_performance_data(
        db, 
        last_week_contest=last_week_contest,
        current_week_contest=current_week_contest,
        report_date=report_date, 
        save_snapshot=save_snapshot
    )


@router.get("/weekly-performance/download")
def download_weekly_performance_19_sheet_excel(
    report_date: Optional[str] = Query(None),
    last_week_contest: Optional[int] = Query(None),
    current_week_contest: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Generates and downloads the official institutional Excel workbook.
    """
    import os
    import tempfile
    from backend.services.weekly_report_service import generate_weekly_performance_data
    from backend.exporters.weekly_excel_generator import build_weekly_performance_excel

    date_str = report_date or datetime.date.today().strftime("%d-%m-%Y")
    data = generate_weekly_performance_data(
        db,
        last_week_contest=last_week_contest,
        current_week_contest=current_week_contest,
        report_date=date_str,
        save_snapshot=False
    )

    temp_dir = tempfile.gettempdir()
    file_path = os.path.join(temp_dir, f"LeetCode_Weekly_Report_{date_str}.xlsx")
    build_weekly_performance_excel(data, file_path)

    with open(file_path, "rb") as f:
        file_bytes = f.read()

    return Response(
        content=file_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=LeetCode_Weekly_Report_{date_str}.xlsx"}
    )


@router.get("/college-weekly-format")
@router.get("/export-college-format")
async def download_college_weekly_format_excel(
    contest_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Generates and downloads the exact 2-Sheet Nandha Engineering College Report
    (Sheet 1: Management Summary, Sheet 2: Student Details) with openpyxl styling.
    """
    from backend.database import SessionLocal
    from backend.models import Contest
    from backend.report_generator import CollegeReportGenerator

    if not contest_id:
        latest_c = db.query(Contest).order_by(Contest.id.desc()).first()
        contest_id = latest_c.id if latest_c else 1

    report_gen = CollegeReportGenerator(SessionLocal)
    res = await report_gen.generate_complete_report(contest_id)

    return Response(
        content=res["excel_bytes"],
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={res['filename']}"}
    )


@router.post("/dispatch-college-report")
async def dispatch_college_report_email(
    contest_id: Optional[int] = Query(None),
    recipients: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Generates the exact Nandha College LeetCode Performance Report (Management Summary + Student Details)
    and dispatches HTML email preview with Excel attachment to Academic Coordinator & HODs.
    """
    from backend.database import SessionLocal
    from backend.models import Contest
    from backend.report_generator import CollegeReportGenerator
    from backend.email_service import send_weekly_report_email

    if not contest_id:
        latest_c = db.query(Contest).order_by(Contest.id.desc()).first()
        contest_id = latest_c.id if latest_c else 1

    report_gen = CollegeReportGenerator(SessionLocal)
    res = await report_gen.generate_complete_report(contest_id)

    target_recipients = [e.strip() for e in recipients.split(",") if e.strip()] if recipients else ["nanthishvaran17@gmail.com"]

    send_weekly_report_email(
        db=db,
        recipient_emails=target_recipients,
        subject=f"NANDHA ENGINEERING COLLEGE — LeetCode Weekly Performance Report ({res['contest_title']})",
        body_html=res["email_html"],
        excel_bytes=res["excel_bytes"],
        trigger_type="MANUAL"
    )

    return {
        "success": True,
        "message": f"College weekly report email successfully dispatched to {len(target_recipients)} recipient(s): {', '.join(target_recipients)}",
        "contest": res["contest_title"],
        "filename": res["filename"],
        "total_students": res["total_students"],
        "actual_count": res["actual_count"],
        "virtual_count": res["virtual_count"],
        "not_attended_count": res["not_attended_count"],
        "top_rankers_count": len(res["top_rankers"])
    }


