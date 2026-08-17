from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
import datetime
from collections import defaultdict

from backend.database import get_db
from backend.models import Student, LeetCodeProfileStats, WeeklyStudentProgress
from backend.security import require_security_access

router = APIRouter(prefix="/api/audit", tags=["Audit"])


@router.get("/data-quality")
def get_full_data_quality_audit(
    db: Session = Depends(get_db),
    current_user=Depends(require_security_access(resource_name="Data Quality Board"))
) -> Dict[str, Any]:
    """
    Complete pipeline health report.
    Returns per-student breakdown, duplicate-pattern detection,
    and aggregate counts for every sync state.
    """
    students = db.query(Student).filter(
        (Student.is_active == True) | (Student.is_active.is_(None))
    ).all()

    total = len(students)
    now = datetime.datetime.now(datetime.timezone.utc)

    # Counters
    verified_count = 0
    pending_count = 0
    failed_count = 0
    stale_count = 0
    mismatch_count = 0
    invalid_count = 0
    never_attempted_count = 0
    identity_mismatch_count = 0
    stats_mismatch_count = 0
    total_verified_problems = 0

    # Duplicate-pattern detection: map (total, easy, medium, hard) -> list of student info
    stats_signature_map: Dict[tuple, List[Dict]] = defaultdict(list)

    student_audit_list: List[Dict] = []

    for s in students:
        st = s.stats
        sync_status = st.sync_status if st else "not_started"
        validation_status = getattr(st, "validation_status", None) if st else None
        last_verified_at = st.last_verified_at if st else None
        last_attempt_at = getattr(st, "last_attempt_at", None) if st else None
        error_code = getattr(st, "error_code", None) if st else None
        error_message = st.error_message if st else None
        retry_count = getattr(st, "retry_count", 0) if st else 0
        total_solved = st.total_solved if st else None

        # Determine real state
        state = "unknown"
        if not st or sync_status in ("not_started", "pending") or total_solved is None:
            if not s.leetcode_url and not s.username:
                state = "invalid"
                invalid_count += 1
            else:
                state = "pending"
                pending_count += 1
                never_attempted_count += 1
        elif sync_status == "success" and validation_status in ("verified", None):
            # Check if stale (>24h since last verified)
            if last_verified_at:
                age_hours = (now - last_verified_at.replace(tzinfo=datetime.timezone.utc)
                             if last_verified_at.tzinfo is None
                             else now - last_verified_at).total_seconds() / 3600
                if age_hours > 24:
                    state = "stale"
                    stale_count += 1
                else:
                    state = "verified"
                    verified_count += 1
            else:
                state = "verified"
                verified_count += 1
            total_verified_problems += (total_solved or 0)
        elif sync_status == "mismatch" or validation_status in ("mismatch", "identity_mismatch"):
            state = "mismatch"
            mismatch_count += 1
            if error_code == "IDENTITY_MISMATCH" or validation_status == "identity_mismatch":
                identity_mismatch_count += 1
            elif error_code == "STATS_SUM_MISMATCH" or validation_status == "mismatch":
                stats_mismatch_count += 1
        elif sync_status == "failed":
            state = "failed"
            failed_count += 1
        else:
            state = "pending"
            pending_count += 1

        # Build stats signature for duplicate detection (only for verified students)
        if state in ("verified", "stale") and st and total_solved is not None:
            ez = st.easy_solved or 0
            med = st.medium_solved or 0
            hd = st.hard_solved or 0
            sig = (total_solved, ez, med, hd)
            stats_signature_map[sig].append({
                "student_id": s.id,
                "reg_no": s.reg_no,
                "name": s.name,
                "username": s.username or "",
                "total_solved": total_solved,
                "easy": ez,
                "medium": med,
                "hard": hd,
                "rating": st.contest_rating,
                "last_verified_at": last_verified_at.isoformat() if last_verified_at else None
            })

        student_audit_list.append({
            "student_id": s.id,
            "reg_no": s.reg_no,
            "name": s.name,
            "username": s.username or "",
            "leetcode_url": s.leetcode_url or "",
            "state": state,
            "sync_status": sync_status,
            "validation_status": validation_status,
            "total_solved": total_solved,
            "easy_solved": st.easy_solved if st else None,
            "medium_solved": st.medium_solved if st else None,
            "hard_solved": st.hard_solved if st else None,
            "contest_rating": st.contest_rating if st else None,
            "last_verified_at": last_verified_at.isoformat() if last_verified_at else None,
            "last_attempt_at": last_attempt_at.isoformat() if last_attempt_at else None,
            "error_code": error_code,
            "error_message": error_message,
            "retry_count": retry_count,
            "source": st.source if st else None
        })

    # Find duplicate-pattern groups (same stats for 2+ students)
    duplicate_groups = []
    for sig, group in stats_signature_map.items():
        if len(group) >= 2 and sig[0] > 0:  # Only flag non-zero duplicates
            duplicate_groups.append({
                "signature": {"total": sig[0], "easy": sig[1], "medium": sig[2], "hard": sig[3]},
                "count": len(group),
                "students": group
            })
    duplicate_groups.sort(key=lambda x: x["count"], reverse=True)
    duplicate_pattern_count = sum(g["count"] for g in duplicate_groups)

    # Leaderboard consistency check: count verified students with total_solved > 0
    leaderboard_eligible = [
        s for s in student_audit_list
        if s["state"] in ("verified", "stale") and (s["total_solved"] or 0) > 0
    ]

    return {
        "generated_at": now.isoformat(),
        "summary": {
            "total_students": total,
            "verified": verified_count,
            "stale": stale_count,
            "pending": pending_count,
            "failed": failed_count,
            "mismatch": mismatch_count,
            "invalid": invalid_count,
            "never_attempted": never_attempted_count,
            "total_verified_problems": total_verified_problems,
            "leaderboard_eligible": len(leaderboard_eligible)
        },
        "integrity": {
            "identity_mismatch_issues": identity_mismatch_count,
            "stats_mismatch_issues": stats_mismatch_count,
            "duplicate_pattern_groups": len(duplicate_groups),
            "duplicate_pattern_affected_students": duplicate_pattern_count
        },
        "duplicate_patterns": duplicate_groups[:20],  # Top 20 duplicate groups
        "students": student_audit_list
    }


@router.get("/student/{student_id}/pipeline")
def get_student_pipeline_audit(
    student_id: int, 
    db: Session = Depends(get_db),
    current_user=Depends(require_security_access(resource_name="Data Quality Board"))
) -> Dict[str, Any]:
    """
    Per-student pipeline verification report.
    Shows every field at every layer.
    """
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        return {"error": f"Student {student_id} not found"}

    st = student.stats
    now = datetime.datetime.now(datetime.timezone.utc)

    # Compute sum validation
    sum_valid = None
    sum_detail = None
    if st and all(v is not None for v in [st.total_solved, st.easy_solved, st.medium_solved, st.hard_solved]):
        calc = (st.easy_solved or 0) + (st.medium_solved or 0) + (st.hard_solved or 0)
        sum_valid = (calc == st.total_solved)
        sum_detail = f"{st.easy_solved} + {st.medium_solved} + {st.hard_solved} = {calc} {'==' if sum_valid else '!='} {st.total_solved}"

    return {
        "student": {
            "id": student.id,
            "reg_no": student.reg_no,
            "name": student.name,
            "username": student.username,
            "leetcode_url": student.leetcode_url
        },
        "database": {
            "total_solved": st.total_solved if st else None,
            "easy_solved": st.easy_solved if st else None,
            "medium_solved": st.medium_solved if st else None,
            "hard_solved": st.hard_solved if st else None,
            "contest_rating": st.contest_rating if st else None,
            "public_profile_ranking": st.public_profile_ranking if st else None,
            "sync_status": st.sync_status if st else "no_stats",
            "validation_status": getattr(st, "validation_status", None) if st else None,
            "source": st.source if st else None,
            "last_verified_at": st.last_verified_at.isoformat() if (st and st.last_verified_at) else None,
            "last_attempt_at": getattr(st, "last_attempt_at", None).isoformat() if (st and getattr(st, "last_attempt_at", None)) else None,
            "error_code": getattr(st, "error_code", None) if st else None,
            "error_message": st.error_message if st else None,
            "retry_count": getattr(st, "retry_count", 0) if st else 0,
        },
        "validation": {
            "sum_valid": sum_valid,
            "sum_detail": sum_detail,
            "has_real_fetch": st.last_verified_at is not None if st else False,
            "is_verified": st.sync_status in ("success", "OK") if st else False,
        },
        "audited_at": now.isoformat()
    }


# ─────────────────────────────────────────────────────────────────────────────
# INSTITUTIONAL FORENSIC AUDIT ENDPOINTS (300 Students × 100 Contests)
# ─────────────────────────────────────────────────────────────────────────────

from backend.models import ForensicAuditJob, ForensicAuditRecord, ForensicStudentIngestStatus
from backend.services.forensic_audit_service import run_forensic_audit_job, get_canonical_100_contests
import asyncio


@router.post("/forensic/run")
async def trigger_forensic_audit(
    background_tasks: bool = True,
    db: Session = Depends(get_db),
    current_user=Depends(require_security_access(resource_name="Data Quality Board"))
) -> Dict[str, Any]:
    """
    Triggers a 300 Students × 100 Contests Institutional Forensic Audit run.
    Applies all 15 mandatory corrections using direct LeetCode GraphQL evidence.
    """
    now_str = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    job_id = f"FAJ-{now_str}"

    if background_tasks:
        asyncio.create_task(run_forensic_audit_job(job_id=job_id, triggered_by=current_user.username if hasattr(current_user, 'username') else "admin"))
        return {
            "message": "Institutional Forensic Audit job launched in background",
            "job_id": job_id,
            "status": "RUNNING",
            "phase": "INGEST"
        }
    else:
        job = await run_forensic_audit_job(job_id=job_id, triggered_by=current_user.username if hasattr(current_user, 'username') else "admin")
        return {
            "message": "Institutional Forensic Audit job completed",
            "job_id": job.job_id,
            "status": job.status,
            "phase": job.phase,
            "total_matrix_cells": job.total_matrix_cells,
            "integrity_pass": job.integrity_pass
        }


@router.get("/forensic/jobs")
def list_forensic_jobs(
    db: Session = Depends(get_db),
    current_user=Depends(require_security_access(resource_name="Data Quality Board"))
) -> List[Dict[str, Any]]:
    """Returns list of all historical forensic audit jobs."""
    jobs = db.query(ForensicAuditJob).order_by(ForensicAuditJob.id.desc()).all()
    return [
        {
            "id": j.id,
            "job_id": j.job_id,
            "status": j.status,
            "phase": j.phase,
            "total_students": j.total_students,
            "students_ingested": j.students_ingested,
            "total_matrix_cells": j.total_matrix_cells,
            "cells_processed": j.cells_processed,
            "verified_attended": j.verified_attended,
            "verified_absent": j.verified_absent,
            "not_found": j.not_found_count,
            "pending_username": j.pending_username_count,
            "source_unavailable": j.source_unavailable,
            "integrity_pass": j.integrity_pass,
            "started_at": j.started_at.isoformat() if j.started_at else None,
            "completed_at": j.completed_at.isoformat() if j.completed_at else None
        }
        for j in jobs
    ]


@router.get("/forensic/job/{job_id}")
def get_forensic_job_status(
    job_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_security_access(resource_name="Data Quality Board"))
) -> Dict[str, Any]:
    """Returns current status and counter metrics for a specific forensic audit job."""
    job = db.query(ForensicAuditJob).filter(ForensicAuditJob.job_id == job_id).first()
    if not job:
        return {"error": f"Forensic Audit Job {job_id} not found"}

    return {
        "job_id": job.job_id,
        "status": job.status,
        "phase": job.phase,
        "total_students": job.total_students,
        "students_ingested": job.students_ingested,
        "students_succeeded": job.students_succeeded,
        "students_failed": job.students_failed,
        "students_no_username": job.students_no_username,
        "total_matrix_cells": job.total_matrix_cells,
        "cells_processed": job.cells_processed,
        "verified_attended": job.verified_attended,
        "verified_absent": job.verified_absent,
        "pending_username": job.pending_username_count,
        "not_found": job.not_found_count,
        "source_unavailable": job.source_unavailable,
        "data_pending": job.data_pending,
        "duplicate_records": job.duplicate_records,
        "fabricated_records": job.fabricated_records,
        "integrity_pass": job.integrity_pass,
        "started_at": job.started_at.isoformat() if job.started_at else None,
        "completed_at": job.completed_at.isoformat() if job.completed_at else None
    }


@router.get("/forensic/matrix/{job_id}")
def get_forensic_matrix(
    job_id: str,
    status_filter: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user=Depends(require_security_access(resource_name="Data Quality Board"))
) -> Dict[str, Any]:
    """Retrieves paginated 300 × 100 matrix records for a forensic audit job."""
    query = db.query(ForensicAuditRecord).filter(ForensicAuditRecord.job_id == job_id)

    if status_filter:
        query = query.filter(ForensicAuditRecord.verification_status == status_filter)

    total_matching = query.count()
    records = query.order_by(ForensicAuditRecord.student_id.asc(), ForensicAuditRecord.contest_number.asc()).offset(offset).limit(limit).all()

    return {
        "job_id": job_id,
        "total_matching": total_matching,
        "limit": limit,
        "offset": offset,
        "records": [
            {
                "id": r.id,
                "student_id": r.student_id,
                "contest_id": r.contest_id,
                "contest_name": r.contest_name,
                "contest_number": r.contest_number,
                "verification_status": r.verification_status,
                "attended": r.attended,
                "problems_solved": r.problems_solved,
                "score": r.score,
                "contest_rank": r.contest_rank,
                "contest_rating": r.contest_rating,
                "q1_solved": r.q1_solved,
                "q2_solved": r.q2_solved,
                "q3_solved": r.q3_solved,
                "q4_solved": r.q4_solved,
                "evidence_hash": r.evidence_hash,
                "source_evidence": r.source_evidence,
                "resolved_at": r.resolved_at.isoformat() if r.resolved_at else None
            }
            for r in records
        ]
    }


@router.get("/forensic/report/{job_id}")
def get_forensic_report(
    job_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_security_access(resource_name="Data Quality Board"))
) -> Dict[str, Any]:
    """Returns the complete formatted forensic audit report text for a job."""
    job = db.query(ForensicAuditJob).filter(ForensicAuditJob.job_id == job_id).first()
    if not job:
        return {"error": f"Forensic Audit Job {job_id} not found"}

    return {
        "job_id": job.job_id,
        "report_text": job.report_text,
        "integrity_pass": job.integrity_pass
    }

