import datetime
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.models import (
    Student, Department, Section, LeetCodeProfileStats,
    StudentStatSnapshot, ContestParticipation, WeeklySession
)
from backend.services.report_data_service import get_problem_category
from backend.logger import logger

def derive_student_batch(year_level: Optional[str]) -> str:
    """Derives standard academic batch from year level."""
    year_map = {
        "II": "2025-2029",
        "2": "2025-2029",
        "III": "2024-2028",
        "3": "2024-2028",
        "IV": "2023-2027",
        "4": "2023-2027",
        "I": "2026-2030",
        "1": "2026-2030"
    }
    return year_map.get(str(year_level).upper().strip(), "2025-2029")


def get_student_status_code(student: Student) -> Tuple[str, Optional[int], Optional[int], Optional[int], Optional[int]]:
    """
    Extracts student stats and distinguishes verified zero solved, missing links, invalid URLs, and network errors.
    Enforces sum check consistency: Easy + Medium + Hard == Total.
    Returns (status_code, total_solved, easy, medium, hard)
    """
    st = student.stats
    if not student.leetcode_url and not student.username:
        return "MISSING_LINK", None, None, None, None

    url_str = (student.leetcode_url or "").strip().lower()
    if url_str and ("google.com" in url_str or "share" in url_str or "drive" in url_str or not url_str.startswith("http")):
        if not student.username:
            return "INVALID_URL", None, None, None, None

    if not st:
        return "DATA_UNAVAILABLE", None, None, None, None

    if st.sync_status in ("failed", "stale") and st.total_solved is None:
        if st.error_code == "PROFILE_NOT_FOUND" or st.status == "PROFILE NOT FOUND":
            return "PROFILE_NOT_FOUND", None, None, None, None
        return "DATA_UNAVAILABLE", None, None, None, None

    is_verified = (st.sync_status in ("success", "OK", "verified", "stale") or st.status == "verified" or st.total_solved is not None)
    if not is_verified:
        return "DATA_UNAVAILABLE", None, None, None, None

    easy = st.easy_solved
    medium = st.medium_solved
    hard = st.hard_solved

    if easy is not None and medium is not None and hard is not None:
        derived_tot = easy + medium + hard
        # Sum validation check
        if st.total_solved is not None and st.total_solved != derived_tot and derived_tot > 0:
            return "DATA_MISMATCH", st.total_solved, easy, medium, hard
        tot = derived_tot
    else:
        tot = st.total_solved

    if tot is None:
        return "DATA_UNAVAILABLE", None, None, None, None

    return "VERIFIED", tot, easy, medium, hard


def generate_weekly_performance_data(
    db: Session,
    last_week_contest: int = 513,
    current_week_contest: int = 514,
    report_date: Optional[str] = None,
    save_snapshot: bool = False
) -> Dict[str, Any]:
    """
    MASTER ACCURACY-CONTROLLED WEEKLY PERFORMANCE REPORT ENGINE
    Fetches student master roster exactly as denominator.
    Isolates Contest sessions perfectly to avoid data leakage.
    Uses WeeklyPublicResult exclusively for contest metrics.
    """
    import re
    from collections import defaultdict
    today_str = report_date or datetime.date.today().strftime("%d.%m.%Y")
    
    # 1. Fetch Roster (All Active Master Students)
    students = db.query(Student).filter((Student.is_active == True) | (Student.is_active.is_(None))).all()
    total_students_count = len(students)

    def derive_batch(year_level):
        year_map = {
            "II": "2025-2029", "2": "2025-2029",
            "III": "2024-2028", "3": "2024-2028",
            "IV": "2023-2027", "4": "2023-2027",
            "I": "2026-2030", "1": "2026-2030"
        }
        return year_map.get(str(year_level).upper().strip(), "2025-2029")

    # Group roster explicitly by dept and batch: (department_code, batch)
    roster_map = defaultdict(list)
    for s in students:
        dept = s.department.code if s.department else "CSE"
        batch = derive_batch(s.year_level)
        roster_map[(dept, batch)].append(s)

    # 2. Resolve Canonical Sessions
    ws_all = db.query(WeeklySession).all()
    
    def _resolve_session(c_num):
        for ws in ws_all:
            if ws.contest_name:
                m = re.search(r'\d+', ws.contest_name)
                if m and int(m.group(0)) == int(c_num):
                    return ws
        return None
        
    last_ws = _resolve_session(last_week_contest)
    curr_ws = _resolve_session(current_week_contest)
    
    last_session_id = last_ws.id if last_ws else -1
    curr_session_id = curr_ws.id if curr_ws else -1
    
    last_date = last_ws.session_date.strftime("%d.%m.%Y") if last_ws and last_ws.session_date else "Not Available"
    curr_date = curr_ws.session_date.strftime("%d.%m.%Y") if curr_ws and curr_ws.session_date else "Not Available"

    # 3. Fetch Authentic Contest Results
    from backend.models import WeeklyPublicResult
    last_results_raw = db.query(WeeklyPublicResult).filter(
        WeeklyPublicResult.session_id == last_session_id,
        WeeklyPublicResult.participation_status.in_(["PUBLIC_ATTENDED", "ATTENDED"])
    ).all() if last_session_id != -1 else []
    
    curr_results_raw = db.query(WeeklyPublicResult).filter(
        WeeklyPublicResult.session_id == curr_session_id,
        WeeklyPublicResult.participation_status.in_(["PUBLIC_ATTENDED", "ATTENDED"])
    ).all() if curr_session_id != -1 else []

    last_res_map = {r.student_id: r for r in last_results_raw}
    curr_res_map = {r.student_id: r for r in curr_results_raw}
    
    data_quality_warnings = []
    batch_summaries = []

    def get_category(solved, is_verified):
        if not is_verified or solved is None:
            return "Not Yet Started"
        if solved > 500: return "Above 500"
        if solved >= 250: return "250 - 500"
        if solved >= 100: return "Less than 250"
        if solved > 0: return "Less than 100"
        return "Not Yet Started"

    # 4. Aggregation Engine
    for (dept, batch), batch_students in sorted(roster_map.items()):
        total_st = len(batch_students)
        
        # Base categories from live LeetCode stats
        cat_counts = {"Above 500": 0, "250 - 500": 0, "Less than 250": 0, "Less than 100": 0, "Not Yet Started": 0}
        rating_1500 = 0
        ranking_20000 = 0
        
        for s in batch_students:
            st = s.stats
            is_verif = False
            tot = 0
            rating = 0
            rank = 0
            if st and (st.sync_status in ("success", "OK", "verified") or st.total_solved is not None):
                is_verif = True
                tot = st.total_solved or 0
                rating = st.contest_rating or 0
                rank = st.public_profile_ranking or 9999999
                
            cat = get_category(tot, is_verif)
            if cat in cat_counts:
                cat_counts[cat] += 1
            else:
                cat_counts["Not Yet Started"] += 1
                
            if rating > 1500:
                rating_1500 += 1
            if rank > 0 and rank < 20000:
                ranking_20000 += 1
                
        # Validate sum
        sum_cat = sum(cat_counts.values())
        if sum_cat != total_st:
            data_quality_warnings.append(
                f"DATA QUALITY ERROR\nContest: {last_week_contest}/{current_week_contest}\nBatch: {batch}\nIssue: Problem categories sum mismatch\nExpected: {total_st}\nCalculated: {sum_cat}"
            )
            
        def process_contest_week(res_map, ws_obj, week_type, c_num):
            q4, q3, q2, q1 = 0, 0, 0, 0
            if ws_obj and ws_obj.status == "SCHEDULED" and not res_map:
                return {"status": "Scheduled", "q4": "—", "q3": "—", "q2": "—", "q1": "—"}
            
            for s in batch_students:
                res = res_map.get(s.id)
                if res:
                    solv = res.total_contest_solved or 0
                    if solv == 4: q4 += 1
                    elif solv == 3: q3 += 1
                    elif solv == 2: q2 += 1
                    elif solv == 1: q1 += 1
                    
                    if (res.q1 + res.q2 + res.q3 + res.q4) != solv:
                        data_quality_warnings.append(
                            f"DATA QUALITY ERROR\nContest: Weekly Contest {c_num}\nBatch: {batch}\nIssue: Q total mismatch for {s.reg_no}\nExpected: {solv}\nCalculated: {res.q1 + res.q2 + res.q3 + res.q4}"
                        )
            
            # Validation
            if q4+q3+q2+q1 > total_st:
                data_quality_warnings.append(
                    f"DATA QUALITY ERROR\nContest: Weekly Contest {c_num}\nBatch: {batch}\nIssue: Participants exceed roster\nExpected: <= {total_st}\nCalculated: {q4+q3+q2+q1}"
                )
                
            return {"status": "Verified", "q4": q4, "q3": q3, "q2": q2, "q1": q1}

        lw_data = process_contest_week(last_res_map, last_ws, "Last Week", last_week_contest)
        cw_data = process_contest_week(curr_res_map, curr_ws, "Current Week", current_week_contest)

        batch_summaries.append({
            "department": dept,
            "batch": batch,
            "total_students": total_st,
            "categories": cat_counts,
            "rating_1500": rating_1500,
            "ranking_20000": ranking_20000,
            "last_week": lw_data,
            "current_week": cw_data
        })

    dataset = {
        "department": "ALL",
        "report_date": today_str,
        "lastWeek": {
            "contestNumber": last_week_contest,
            "sessionId": last_session_id,
            "date": last_date
        },
        "currentWeek": {
            "contestNumber": current_week_contest,
            "sessionId": curr_session_id,
            "date": curr_date
        },
        "batch_summaries": batch_summaries,
        "data_quality": data_quality_warnings
    }
    
    return dataset


def run_sunday_0945_public_contest_workflow(db: Session, contest_id: Optional[str] = None) -> Dict[str, Any]:
    """
    SUNDAY 9:45 AM PUBLIC CONTEST WORKFLOW — ALL ACTIVE STUDENTS
    1. Identifies latest public contest.
    2. Fetches PUBLIC contest participation for all active students.
    3. Records PUBLIC participations without modifying VIRTUAL records.
    4. Generates Public_Contest.xlsx.
    5. Computes Public summary breakdown.
    6. Dispatches 9:45 AM Email Report with Public_Contest.xlsx attached.
    """
    from backend.services.contest_service import record_contest_participation
    from backend.exporters.weekly_excel_generator import build_public_contest_excel
    from backend.email_service import send_public_contest_report_email
    from backend.services.firestore_service import get_firestore_doc, update_firestore_doc

    today_str = datetime.date.today().strftime("%Y-%m-%d")
    c_id = contest_id or f"weekly-contest-{datetime.date.today().strftime('%W')}"
    c_name = f"Weekly Contest"

    # Idempotency Duplicate Protection Check
    idempotency_key = f"CONTEST_PUBLIC_{c_id}_{today_str}"
    existing_job = get_firestore_doc("sync_jobs", idempotency_key)
    if existing_job and existing_job.get("status") == "COMPLETED":
        logger.info(f"[SUNDAY_0945_SKIPPED] Sunday 9:45 AM workflow already executed for key {idempotency_key}.")
        return {"status": "SKIPPED", "message": f"Sunday 9:45 AM workflow already completed for {c_id}"}


    students = db.query(Student).filter((Student.is_active == True) | (Student.is_active.is_(None))).all()

    rows = []
    q4, q3, q2, q1, not_att, fetch_fail, mode_unc = 0, 0, 0, 0, 0, 0, 0

    for idx, s in enumerate(students, start=1):
        st = s.stats
        if not s.leetcode_url and not s.username:
            status = "NOT_ATTENDED"
            q_solved = 0
            err_msg = "Missing profile link"
        elif st and st.sync_status in ("failed", "stale") and st.total_solved is None:
            status = "FETCH_FAILED"
            q_solved = 0
            err_msg = st.error_message or "API fetch failed"
        elif st and st.recent_contest_score and "/" in st.recent_contest_score:
            try:
                parts = st.recent_contest_score.split("/")
                q_solved = int(parts[0].strip())
            except Exception:
                q_solved = 0
            status = "ATTENDED" if q_solved > 0 else "ATTENDED"
            err_msg = None
        else:
            status = "NOT_ATTENDED"
            q_solved = 0
            err_msg = None

        rec = record_contest_participation(
            db=db,
            student_id=s.id,
            contest_id=c_id,
            contest_name=c_name,
            participation_mode="PUBLIC",
            questions_solved=q_solved,
            questions_total=4,
            contest_rank=st.contest_global_ranking if st else None,
            contest_rating=st.contest_rating if st else None,
            status=status,
            error_message=err_msg
        )

        if status == "ATTENDED":
            if q_solved >= 4: q4 += 1
            elif q_solved == 3: q3 += 1
            elif q_solved == 2: q2 += 1
            elif q_solved == 1: q1 += 1
            else: not_att += 1
        elif status == "FETCH_FAILED":
            fetch_fail += 1
        elif status == "MODE_UNCERTAIN":
            mode_unc += 1
        else:
            not_att += 1

        batch = derive_student_batch(s.year_level)
        dept_code = s.department.code if s.department else "GEN"

        rows.append({
            "s_no": idx,
            "reg_no": s.reg_no,
            "student_name": s.name,
            "department": dept_code,
            "year": s.year_level,
            "batch": batch,
            "username": s.username or "N/A",
            "contest_name": c_name,
            "contest_number": None,
            "contest_date": today_str,
            "attended": rec.attended,
            "questions_solved": rec.questions_solved,
            "questions_total": rec.questions_total,
            "score_display": rec.score_display,
            "contest_rank": rec.contest_rank,
            "contest_rating": rec.contest_rating,
            "top_percentage": rec.top_percentage,
            "status": rec.status,
            "fetched_at": rec.fetched_at.strftime("%Y-%m-%d %H:%M:%S") if rec.fetched_at else None
        })

    excel_data = {
        "report_date": today_str,
        "contest_name": c_name,
        "contest_date": today_str,
        "public_summary": {
            "q4": q4, "q3": q3, "q2": q2, "q1": q1,
            "not_attended": not_att, "fetch_failed": fetch_fail, "mode_uncertain": mode_unc
        },
        "rows": rows
    }

    import os
    os.makedirs("reports", exist_ok=True)
    excel_path = f"reports/Public_Contest_{today_str}.xlsx"
    build_public_contest_excel(excel_data, excel_path)

    send_public_contest_report_email(excel_data, excel_path)

    return {
        "workflow": "SUNDAY_0945_PUBLIC_CONTEST",
        "status": "COMPLETED",
        "total_processed": len(rows),
        "excel_path": excel_path,
        "public_summary": excel_data["public_summary"]
    }


def run_sunday_2200_virtual_contest_workflow(db: Session, contest_id: Optional[str] = None) -> Dict[str, Any]:
    """
    SUNDAY 10:00 PM VIRTUAL & COMBINED CONTEST FINAL WORKFLOW — ALL ACTIVE STUDENTS
    1. Identifies latest contest.
    2. Fetches VIRTUAL contest participation for all active students.
    3. Records VIRTUAL participations without modifying PUBLIC records.
    4. Generates Virtual_Contest.xlsx & Contest_Combined.xlsx.
    5. Dispatches 10:00 PM Final Email Report.
    """
    from backend.services.contest_service import record_contest_participation, build_student_contest_dto
    from backend.exporters.weekly_excel_generator import build_virtual_contest_excel, build_contest_combined_excel
    from backend.email_service import send_final_combined_contest_report_email
    from backend.models import StudentContestParticipation
    from backend.services.firestore_service import get_firestore_doc, update_firestore_doc

    today_str = datetime.date.today().strftime("%Y-%m-%d")
    c_id = contest_id or f"weekly-contest-{datetime.date.today().strftime('%W')}"
    c_name = f"Weekly Contest"

    # Idempotency Duplicate Protection Check
    idempotency_key = f"CONTEST_FINAL_{c_id}_{today_str}"
    existing_job = get_firestore_doc("sync_jobs", idempotency_key)
    if existing_job and existing_job.get("status") == "COMPLETED":
        logger.info(f"[SUNDAY_2200_SKIPPED] Sunday 10:00 PM workflow already executed for key {idempotency_key}.")
        return {"status": "SKIPPED", "message": f"Sunday 10:00 PM workflow already completed for {c_id}"}


    students = db.query(Student).filter((Student.is_active == True) | (Student.is_active.is_(None))).all()

    vir_rows = []
    combined_rows = []
    vq4, vq3, vq2, vq1, v_not_att, v_fetch_fail, v_mode_unc = 0, 0, 0, 0, 0, 0, 0
    validation_logs = []

    for idx, s in enumerate(students, start=1):
        vir_rec_query = db.query(StudentContestParticipation).filter(
            StudentContestParticipation.student_id == s.id,
            StudentContestParticipation.contest_id == c_id,
            StudentContestParticipation.participation_mode == "VIRTUAL"
        ).first()

        if vir_rec_query:
            status = vir_rec_query.status
            q_solved = vir_rec_query.questions_solved
            err_msg = vir_rec_query.error_message
        else:
            status = "NOT_ATTENDED"
            q_solved = 0
            err_msg = None

        rec = record_contest_participation(
            db=db,
            student_id=s.id,
            contest_id=c_id,
            contest_name=c_name,
            participation_mode="VIRTUAL",
            questions_solved=q_solved,
            questions_total=4,
            status=status,
            error_message=err_msg
        )

        if status == "ATTENDED":
            if q_solved >= 4: vq4 += 1
            elif q_solved == 3: vq3 += 1
            elif q_solved == 2: vq2 += 1
            elif q_solved == 1: vq1 += 1
            else: v_not_att += 1
        elif status == "FETCH_FAILED":
            v_fetch_fail += 1
        elif status == "MODE_UNCERTAIN":
            v_mode_unc += 1
        else:
            v_not_att += 1

        batch = derive_student_batch(s.year_level)
        dept_code = s.department.code if s.department else "GEN"

        vir_rows.append({
            "s_no": idx,
            "reg_no": s.reg_no,
            "student_name": s.name,
            "department": dept_code,
            "year": s.year_level,
            "batch": batch,
            "username": s.username or "N/A",
            "contest_name": c_name,
            "contest_number": None,
            "contest_date": today_str,
            "attended": rec.attended,
            "questions_solved": rec.questions_solved,
            "questions_total": rec.questions_total,
            "score_display": rec.score_display,
            "contest_rank": rec.contest_rank,
            "contest_rating": rec.contest_rating,
            "top_percentage": rec.top_percentage,
            "status": rec.status,
            "fetched_at": rec.fetched_at.strftime("%Y-%m-%d %H:%M:%S") if rec.fetched_at else None
        })

        dto = build_student_contest_dto(db, s, c_id)
        dto["batch"] = batch
        dto["fetched_at"] = rec.fetched_at.strftime("%Y-%m-%d %H:%M:%S") if rec.fetched_at else None
        combined_rows.append(dto)

        if status in ("FETCH_FAILED", "MODE_UNCERTAIN", "PARSER_ERROR"):
            validation_logs.append({
                "reg_no": s.reg_no,
                "student_name": s.name,
                "username": s.username or "N/A",
                "contest_name": c_name,
                "contest_number": None,
                "participation_mode": "VIRTUAL",
                "questions_solved": q_solved,
                "questions_total": 4,
                "contest_rank": None,
                "contest_rating": None,
                "status": status,
                "error_message": err_msg or "Validation flag",
                "fetched_at": rec.fetched_at.strftime("%Y-%m-%d %H:%M:%S") if rec.fetched_at else None
            })

    vir_excel_data = {
        "report_date": today_str,
        "contest_name": c_name,
        "contest_date": today_str,
        "virtual_summary": {
            "q4": vq4, "q3": vq3, "q2": vq2, "q1": vq1,
            "not_attended": v_not_att, "fetch_failed": v_fetch_fail, "mode_uncertain": v_mode_unc
        },
        "rows": vir_rows
    }

    import os
    os.makedirs("reports", exist_ok=True)
    vir_excel_path = f"reports/Virtual_Contest_{today_str}.xlsx"
    build_virtual_contest_excel(vir_excel_data, vir_excel_path)

    combined_excel_data = {
        "report_date": today_str,
        "contest_name": c_name,
        "contest_date": today_str,
        "rows": combined_rows,
        "validation_logs": validation_logs
    }

    combined_excel_path = f"reports/Contest_Combined_{today_str}.xlsx"
    build_contest_combined_excel(combined_excel_data, combined_excel_path)

    send_final_combined_contest_report_email(combined_excel_data, vir_excel_path, combined_excel_path)

    return {
        "workflow": "SUNDAY_2200_VIRTUAL_CONTEST",
        "status": "COMPLETED",
        "total_processed": len(combined_rows),
        "virtual_excel_path": vir_excel_path,
        "combined_excel_path": combined_excel_path,
        "virtual_summary": vir_excel_data["virtual_summary"]
    }

