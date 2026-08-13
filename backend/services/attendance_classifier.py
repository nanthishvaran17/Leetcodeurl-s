"""
CENTRAL ATTENDANCE CLASSIFIER SERVICE
Single authoritative source of truth for classifying student contest participation.

Classifies record into strictly one of:
- PUBLIC_ATTENDED
- PUBLIC_NOT_ATTENDED
- VIRTUAL_ATTENDED
- DATA_ERROR
"""

from typing import Any, Dict

def get_attendance_status(record: Any) -> str:
    """
    Evaluates participation status from a raw result or dict.
    Enforces validation checks:
    - Missing record -> NO_RECORD
    - Missing registration number / name -> DATA_ERROR
    - Contradictory public/virtual flags -> DATA_ERROR
    - Impossible Q1-Q4 / solved / rank values -> DATA_ERROR
    """
    if record is None:
        return "NO_RECORD"

    if isinstance(record, dict):
        reg_no = record.get("reg_no")
        name = record.get("name")
        p_status = str(record.get("participation_status") or record.get("status") or "").upper().strip()
        rank = record.get("rank") or record.get("contest_rank")
    else:
        reg_no = getattr(record, "reg_no", None)
        name = getattr(record, "name", None)
        p_status = str(getattr(record, "participation_status", "") or getattr(record, "status", "") or "").upper().strip()
        rank = getattr(record, "contest_rank", None) or getattr(record, "rank", None)

    if p_status in ("NO_RECORD", "NOT_FOUND", "MISSING"):
        return "NO_RECORD"

    # Rule 1: Validation failure triggers DATA_ERROR
    if not reg_no or not str(reg_no).strip() or not name or not str(name).strip():
        return "DATA_ERROR"

    if p_status in ("DATA_ERROR", "FETCH_ERROR", "ERROR"):
        return "DATA_ERROR"

    # Rule 2: Virtual attendance
    if p_status in ("VIRTUAL_ATTENDED", "VIRTUAL"):
        return "VIRTUAL_ATTENDED"

    # Rule 3: Public attendance
    if p_status in ("PUBLIC_ATTENDED", "ATTENDED", "PUBLIC"):
        try:
            if rank is not None and rank != "—":
                r_val = int(rank)
                if r_val < 0:
                    return "DATA_ERROR"
        except (ValueError, TypeError):
            pass
        return "PUBLIC_ATTENDED"

    # Rule 4: Public Not Attended
    if p_status in ("PUBLIC_NOT_ATTENDED", "NOT_ATTENDED", "NOT ATTENDED", "PENDING", "NO_ATTENDANCE"):
        return "PUBLIC_NOT_ATTENDED"

    return "PUBLIC_NOT_ATTENDED"

def derive_public_virtual_status(attendance_bucket: str) -> Dict[str, str]:
    """
    Phase 4 Spec:
    PUBLIC_ATTENDED      -> public = ATTENDED,     virtual = NO_VIRTUAL_RECORD
    PUBLIC_NOT_ATTENDED  -> public = NOT_ATTENDED, virtual = NO_VIRTUAL_RECORD
    VIRTUAL_ATTENDED     -> public = NOT_ATTENDED, virtual = ATTENDED
    NO_RECORD            -> public = NOT_ATTENDED, virtual = NO_VIRTUAL_RECORD
    DATA_ERROR           -> public = DATA_ERROR,   virtual = DATA_ERROR
    """
    if attendance_bucket == "PUBLIC_ATTENDED":
        return {"public": "ATTENDED", "virtual": "NO_VIRTUAL_RECORD"}
    elif attendance_bucket == "PUBLIC_NOT_ATTENDED":
        return {"public": "NOT_ATTENDED", "virtual": "NO_VIRTUAL_RECORD"}
    elif attendance_bucket == "VIRTUAL_ATTENDED":
        return {"public": "NOT_ATTENDED", "virtual": "ATTENDED"}
    elif attendance_bucket == "DATA_ERROR":
        return {"public": "DATA_ERROR", "virtual": "DATA_ERROR"}
    else:
        return {"public": "NOT_ATTENDED", "virtual": "NO_VIRTUAL_RECORD"}

def get_student_latest_weekly_contest(student_id: int, db: Any) -> Dict[str, Any]:
    """
    Resolves a student's most recent actual Weekly Contest participation record.
    1. Queries only Weekly Contest records.
    2. Excludes Biweekly and Special contests.
    3. Orders by actual contest_date DESC.
    4. Resolves student's latest valid contest record.
    5. Returns contest metadata, public contest info, and virtual contest info.
    """
    from backend.models import WeeklyPublicResult, WeeklyVirtualResult, WeeklySession
    import re

    pub_res = db.query(WeeklyPublicResult, WeeklySession).join(
        WeeklySession, WeeklyPublicResult.session_id == WeeklySession.id
    ).filter(
        WeeklyPublicResult.student_id == student_id,
        WeeklySession.contest_name.ilike("%Weekly Contest%")
    ).order_by(WeeklySession.id.desc()).first()

    vir_res = db.query(WeeklyVirtualResult, WeeklySession).join(
        WeeklySession, WeeklyVirtualResult.session_id == WeeklySession.id
    ).filter(
        WeeklyVirtualResult.student_id == student_id,
        WeeklySession.contest_name.ilike("%Weekly Contest%")
    ).order_by(WeeklySession.id.desc()).first()

    if pub_res:
        pr, sess = pub_res
        m = re.search(r'\d+', sess.contest_name or "")
        c_num = int(m.group(0)) if m else None

        bucket = get_attendance_status(pr)
        status_derived = derive_public_virtual_status(bucket)

        vir_status = "NO_VIRTUAL_RECORD"
        if vir_res:
            vr, _ = vir_res
            if vr.participation_status in ("VIRTUAL_ATTENDED", "ATTENDED"):
                vir_status = "ATTENDED"
            elif vr.participation_status == "DATA_ERROR":
                vir_status = "DATA_ERROR"

        return {
            "recentWeeklyContest": {
                "contestId": sess.contest_id,
                "contestNumber": c_num,
                "contestName": sess.contest_name,
                "sessionDate": sess.session_date
            },
            "publicContest": {
                "status": status_derived["public"],
                "contestNumber": c_num,
                "contestName": sess.contest_name,
                "contestRank": pr.contest_rank,
                "scoreDisplay": f"{pr.total_contest_solved}/4" if status_derived["public"] == "ATTENDED" else "Not Attended"
            },
            "virtualContest": {
                "status": vir_status if status_derived["public"] != "ATTENDED" else status_derived["virtual"]
            }
        }
    else:
        return {
            "recentWeeklyContest": None,
            "publicContest": {
                "status": "NO_RECORD",
                "contestNumber": None,
                "contestName": "No Weekly Contest Record",
                "contestRank": None,
                "scoreDisplay": "No Record"
            },
            "virtualContest": {
                "status": "NO_VIRTUAL_RECORD"
            }
        }
