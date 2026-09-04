from sqlalchemy.orm import Session
from sqlalchemy import func, case, and_, desc, asc, nullslast
from typing import Optional, Dict, Any

from backend.models import Student, WeeklyPublicResult, WeeklyVirtualResult, Department, User
from backend.services.canonical_contest_engine import normalize_participation_status

def get_paginated_matrix_rows(
    session_id: int,
    db: Session,
    page: int,
    limit: int,
    dept: Optional[str] = None,
    year: Optional[str] = None,
    attendance: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: Optional[str] = None,
    current_user: Optional[User] = None
) -> Dict[str, Any]:
    
    query = db.query(Student, WeeklyPublicResult, WeeklyVirtualResult).outerjoin(
        WeeklyPublicResult, 
        and_(Student.id == WeeklyPublicResult.student_id, WeeklyPublicResult.session_id == session_id)
    ).outerjoin(
        WeeklyVirtualResult,
        and_(Student.id == WeeklyVirtualResult.student_id, WeeklyVirtualResult.session_id == session_id)
    ).outerjoin(
        Department, Student.department_id == Department.id
    ).filter(
        (Student.is_active == True) | (Student.is_active.is_(None))
    )

    # ── AUTHORITATIVE RBAC SCOPE GATE ────────────────────────────────────────
    # Must be applied BEFORE total_count and all other filters.
    # Admin/Principal → unmodified (global scope)
    # HOD → department scope
    # Staff/Faculty → assigned students only (fail-closed: 0 if no assignments)
    # This reuses the centralized authorization_service — no duplicate logic.
    if current_user is not None:
        from backend.services.authorization_service import apply_role_based_student_filter
        query = apply_role_based_student_filter(query, current_user, db)
    # ─────────────────────────────────────────────────────────────────────────

    # 1. Complex CASE for department
    dept_expr = case(
        (func.upper(Student.reg_no).like('%CC%'), 'CSE(CS)'),
        (func.upper(Student.reg_no).like('%CI%'), 'CSE(IOT)'),
        (func.upper(Student.reg_no).like('%CIR%'), 'CSE(IOT)'),
        else_=func.coalesce(Department.code, WeeklyPublicResult.dept, 'CSE')
    )

    # 2. Complex CASE for year
    year_expr = case(
        (func.upper(Student.reg_no).like('732225%'), 'II'),
        (func.upper(Student.reg_no).like('%25CC%'), 'II'),
        (func.upper(Student.reg_no).like('%25CI%'), 'II'),
        (func.upper(Student.reg_no).like('732224%'), 'III'),
        (func.upper(Student.reg_no).like('%24CC%'), 'III'),
        (func.upper(Student.reg_no).like('%24CI%'), 'III'),
        (func.upper(Student.reg_no).like('732223%'), 'IV'),
        (func.upper(Student.reg_no).like('%23CC%'), 'IV'),
        (func.upper(Student.reg_no).like('%23CI%'), 'IV'),
        else_=func.coalesce(Student.year_level, WeeklyPublicResult.year, 'III')
    )

    # 3. Apply Filters
    if dept and dept.upper() != 'ALL':
        query = query.filter(func.upper(dept_expr) == dept.upper())
        
    if year and year.upper() != 'ALL':
        query = query.filter(func.upper(year_expr) == year.upper())
        
    if search:
        s = f"%{search.strip()}%"
        query = query.filter(
            (Student.name.ilike(s)) |
            (Student.reg_no.ilike(s)) |
            (Student.username.ilike(s))
        )
        
    if attendance and attendance.upper() != 'ALL':
        att = attendance.upper()
        if att == 'PUBLIC':
            query = query.filter(
                func.upper(WeeklyPublicResult.participation_status).in_(['PUBLIC', 'PUBLIC_ATTENDED', 'ATTENDED', 'OFFICIAL'])
            )
        elif att == 'VIRTUAL':
            query = query.filter(
                (func.upper(WeeklyVirtualResult.participation_status) == 'VIRTUAL') |
                (func.upper(WeeklyPublicResult.participation_status) == 'VIRTUAL') |
                (WeeklyVirtualResult.total_contest_solved > 0)
            )
        elif att == 'NOT_ATTENDED':
            query = query.filter(
                func.coalesce(func.upper(WeeklyPublicResult.participation_status), 'NOT_ATTENDED').in_(['NOT_ATTENDED', 'PUBLIC_NOT_ATTENDED', 'ABSENT', 'PENDING'])
            )

    total_count = query.count()
    
    if sort_by == "score":
        query = query.order_by(nullslast(desc(func.coalesce(WeeklyPublicResult.contest_score, WeeklyVirtualResult.contest_score))), Student.name.asc())
    elif sort_by == "rank":
        query = query.order_by(nullslast(asc(func.coalesce(WeeklyPublicResult.contest_rank, WeeklyVirtualResult.contest_rank))), Student.name.asc())
    else:
        query = query.order_by(
            nullslast(asc(WeeklyPublicResult.contest_rank)), 
            nullslast(desc(WeeklyPublicResult.contest_score)), 
            Student.name.asc()
        )

    offset = (page - 1) * limit
    results = query.offset(offset).limit(limit).all()
    
    matrix_rows = []
    
    for student, p_res, v_res in results:
        dept_raw = (student.department.code if student.department else None) or (p_res.dept if p_res else None) or "CSE"
        reg_upper = (student.reg_no or "").upper()
        if "CC" in reg_upper: dept_raw = "CSE(CS)"
        elif "CI" in reg_upper or "CIR" in reg_upper: dept_raw = "CSE(IOT)"
        
        dept_code = str(dept_raw).strip().upper()
        if dept_code in ("CSE(IOT)", "IOT", "CSE_IOT"): dept_code = "CSE(IOT)"
        elif dept_code in ("CSE(CS)", "CS", "CYBER", "CYBER SECURITY", "CSE_CS"): dept_code = "CSE(CS)"
        elif dept_code in ("IT", "INFORMATION TECHNOLOGY"): dept_code = "IT"
        elif dept_code in ("AIDS", "AI&DS", "AI-DS", "AI DS"): dept_code = "AIDS"
        elif dept_code in ("ECE", "ELECTRONICS"): dept_code = "ECE"
        elif dept_code in ("EEE", "ELECTRICAL"): dept_code = "EEE"
        elif dept_code in ("MECH", "MECHANICAL"): dept_code = "MECH"
        elif dept_code in ("CIVIL",): dept_code = "CIVIL"
        elif dept_code in ("AGRI", "AGRICULTURE"): dept_code = "AGRI"
        elif dept_code in ("BME", "BIOMEDICAL"): dept_code = "BME"
        elif dept_code in ("CSE", "COMPUTER SCIENCE"): dept_code = "CSE"
        else: dept_code = dept_raw
        
        year_level = student.year_level or (p_res.year if p_res else None) or "III"
        if reg_upper.startswith("732225") or "25CC" in reg_upper or "25CI" in reg_upper: year_level = "II"
        elif reg_upper.startswith("732224") or "24CC" in reg_upper or "24CI" in reg_upper or "24CIR" in reg_upper: year_level = "III"
        elif reg_upper.startswith("23") or reg_upper.startswith("732223") or "23CC" in reg_upper or "23CI" in reg_upper: year_level = "IV"
        
        username = student.username or ""
        profile_url = student.leetcode_url or (f"https://leetcode.com/u/{username}" if username else "")
        
        p_status = normalize_participation_status(p_res.participation_status if p_res else None, p_res.fetch_status if p_res else None)
        v_status = normalize_participation_status(v_res.participation_status if v_res else None) if v_res else None

        if p_status == "PUBLIC": canon_status = "PUBLIC"
        elif v_status == "VIRTUAL" or (v_res and getattr(v_res, "total_contest_solved", 0) > 0): canon_status = "VIRTUAL"
        elif p_status == "VIRTUAL": canon_status = "VIRTUAL"
        elif p_status == "NOT_ATTENDED" or (p_res and p_res.participation_status in ("NOT_ATTENDED", "PUBLIC_NOT_ATTENDED", "ABSENT")): canon_status = "NOT_ATTENDED"
        elif v_status == "NOT_ATTENDED": canon_status = "NOT_ATTENDED"
        else:
            raw_status = p_res.participation_status if p_res else (v_res.participation_status if v_res else "PENDING")
            fetch_status = p_res.fetch_status if p_res else "PENDING"
            canon_status = normalize_participation_status(raw_status, fetch_status)
            
        if not username or len(username.strip()) < 2:
            canon_status = "USERNAME_NOT_FOUND"

        q1_val = 0; q2_val = 0; q3_val = 0; q4_val = 0; score_val = 0
        rank_val = None; rating_val = None

        if canon_status == "PUBLIC" and p_res:
            q1_val = 1 if (p_res.q1 and p_res.q1 >= 1) else 0
            q2_val = 1 if (p_res.q2 and p_res.q2 >= 1) else 0
            q3_val = 1 if (p_res.q3 and p_res.q3 >= 1) else 0
            q4_val = 1 if (p_res.q4 and p_res.q4 >= 1) else 0
            score_val = p_res.contest_score
            if (q1_val + q2_val + q3_val + q4_val) == 0 and score_val:
                sv = int(float(score_val))
                if sv >= 18: q1_val = 1; q2_val = 1; q3_val = 1; q4_val = 1
                elif sv == 12: q1_val = 1; q2_val = 1; q3_val = 1
                elif sv == 7: q1_val = 1; q2_val = 1
                elif sv == 3: q1_val = 1
            if not score_val: score_val = (q1_val * 3 + q2_val * 4 + q3_val * 5 + q4_val * 6)
            rank_val = p_res.contest_rank
            rating_val = p_res.contest_rating
        elif canon_status == "VIRTUAL":
            source_res = v_res if v_res else p_res
            if source_res:
                q1_val = 1 if (getattr(source_res, "q1", 0) and getattr(source_res, "q1", 0) >= 1) else 0
                q2_val = 1 if (getattr(source_res, "q2", 0) and getattr(source_res, "q2", 0) >= 1) else 0
                q3_val = 1 if (getattr(source_res, "q3", 0) and getattr(source_res, "q3", 0) >= 1) else 0
                q4_val = 1 if (getattr(source_res, "q4", 0) and getattr(source_res, "q4", 0) >= 1) else 0
                score_val = getattr(source_res, "contest_score", getattr(source_res, "total_contest_solved", 0) * 3)
                if (q1_val + q2_val + q3_val + q4_val) == 0 and score_val:
                    sv = int(float(score_val))
                    if sv >= 18: q1_val = 1; q2_val = 1; q3_val = 1; q4_val = 1
                    elif sv == 12: q1_val = 1; q2_val = 1; q3_val = 1
                    elif sv == 7: q1_val = 1; q2_val = 1
                    elif sv == 3: q1_val = 1
                if not score_val: score_val = (q1_val * 3 + q2_val * 4 + q3_val * 5 + q4_val * 6)
                rank_val = getattr(source_res, "contest_rank", None)
                rating_val = getattr(source_res, "contest_rating", None)

        matrix_rows.append({
            "id": student.id,
            "reg_no": student.reg_no,
            "name": student.name,
            "username": username,
            "profile_url": profile_url,
            "dept": dept_code,
            "year": year_level,
            "status": canon_status,
            "q1": q1_val,
            "q2": q2_val,
            "q3": q3_val,
            "q4": q4_val,
            "score": score_val,
            "rank": rank_val,
            "rating": rating_val,
            "avatar_url": getattr(student.lc_profile, "avatar_url", None) if getattr(student, "lc_profile", None) else None,
            "section": getattr(student.section, "name", None) if getattr(student, "section", None) else None,
        })
        
    return {
        "items": matrix_rows,
        "total": total_count,
        "page": page,
        "limit": limit
    }
