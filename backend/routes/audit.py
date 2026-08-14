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
