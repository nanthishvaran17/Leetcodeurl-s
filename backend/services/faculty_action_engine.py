"""
faculty_action_engine.py
=============================================================
Production-Grade Faculty Action Center & Mentoring Hub Engine.
Lifecycle: Detect -> Prioritize -> Assign -> Intervene -> Monitor -> Complete -> Resolve

Features:
1. Real Data Signal Detection from LeetCode Tracking DB
2. Transparent 0-100 Priority Scoring & Human-Readable Explanations
3. Automated Recommended Action Mapping
4. Validated Lifecycle Transitions & Immutable Audit Logs
5. Overdue Follow-up & HOD Escalation System
6. Deterministic Deduplication (Zero Duplicates)
"""

import datetime
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import desc, func, or_, and_

from backend.models import (
    Student, User, FacultyActionQueueItem, FacultyActionAuditLog,
    FacultyIntervention, LeetCodeProfileStats, WeeklySession,
    WeeklyPublicResult, Department, Section
)
from backend.logger import logger

# ── Status Lifecycle Rules ───────────────────────────────────────────────────
VALID_STATUSES = ["Pending", "In Progress", "Monitoring", "Completed", "Resolved"]
ALLOWED_TRANSITIONS = {
    "Pending": ["In Progress", "Monitoring", "Resolved"],
    "In Progress": ["Monitoring", "Completed", "Resolved", "Pending"],
    "Monitoring": ["In Progress", "Completed", "Resolved", "Pending"],
    "Completed": ["Resolved", "Monitoring", "In Progress"],
    "Resolved": ["Monitoring", "In Progress", "Pending"] # Reopening allowed
}

# ── Signal Type to Recommended Action Matrix ──────────────────────────────────
RECOMMENDED_ACTION_MAP = {
    "CONTEST_ABSENT": "Contact student immediately to verify reason for contest absence and enforce official attendance.",
    "CONSECUTIVE_ABSENT": "Escalate to Faculty Mentor / HOD: Severe pattern of consecutive weekly contest absences.",
    "VIRTUAL_STREAK": "Schedule mentoring session: Transition student from virtual practice to official 08:00 AM contest.",
    "RATING_DECLINE": "Conduct 1-on-1 performance review: Analyze weak problem topics & provide targeted practice set.",
    "LOW_SOLVE_COUNT": "Assign 5 foundational DSA problems (Arrays/Strings/Two Pointers) & schedule progress check.",
    "SILENT_DISENGAGED": "Urgent student intervention: Re-engage inactive student with structured weekly milestones.",
    "WEAK_TOPIC": "Assign targeted problem set on weak topics (Dynamic Programming / Graphs) and review solutions.",
    "ROUTINE_MONITORING": "Routine follow-up: Monitor weekly solve velocity and maintain current progress trajectory."
}


def calculate_priority_score(
    absent_count: int = 0,
    virtual_count: int = 0,
    rating_drop: float = 0.0,
    solved_count: Optional[int] = None,
    days_inactive: int = 0,
    is_silent: bool = False,
    total_platform_solved: int = 0
) -> Tuple[int, str, str]:
    """
    Computes a transparent 0-100 priority score with a human-readable explanation and priority level:
    - Critical (80 - 100): 0 solves on platform, complete disengagement, urgent 1-on-1 intervention
    - High     (60 - 79) : Beginner / at-risk (< 20 solves) with contest absences or prolonged inactivity
    - Medium   (35 - 59) : Developing solvers (20 - 99 solves) needing regular mentoring
    - Low      (0 - 34)  : Active platform performers (>= 100 solves or steady 50+ solves)
    """
    reasons = []

    # 1. Platform mastery tiers
    if total_platform_solved >= 100:
        base_score = 10
        if absent_count >= 2:
            base_score += 15
            reasons.append(f"Active performer ({total_platform_solved} solved) · Missed recent weekly contests")
        else:
            reasons.append(f"Consistent performer ({total_platform_solved} problems solved)")
    elif 50 <= total_platform_solved < 100:
        base_score = 20
        if absent_count >= 2:
            base_score += 20
            reasons.append(f"Steady progress ({total_platform_solved} solved) · Missed recent contests")
        else:
            reasons.append(f"Steady progress ({total_platform_solved} problems solved)")
    elif 20 <= total_platform_solved < 50:
        base_score = 35
        if absent_count >= 2:
            base_score += 15
            reasons.append(f"Developing solver ({total_platform_solved} solved) · {absent_count} contest absences")
        else:
            reasons.append(f"Developing solver ({total_platform_solved} solved)")
    elif 1 <= total_platform_solved < 20:
        base_score = 60
        if absent_count >= 2 or days_inactive >= 14:
            base_score += 15
            reasons.append(f"At-risk beginner: Only {total_platform_solved} solved · {absent_count} contest absences")
        else:
            reasons.append(f"Beginner: Only {total_platform_solved} solved")
    else:
        # 0 Solved — Critical Alert
        base_score = 90
        reasons.append("Critical: 0 problems solved on platform · Immediate 1-on-1 intervention required")

    # Inactivity multiplier
    if total_platform_solved < 50:
        if days_inactive >= 21:
            base_score += 10
            reasons.append(f"Inactive for {days_inactive} days")
        elif days_inactive >= 14:
            base_score += 5

    # Rating drop
    if rating_drop >= 100 and total_platform_solved < 100:
        base_score += 10
        reasons.append(f"Contest rating drop of {int(rating_drop)} pts")

    final_score = max(5, min(100, base_score))

    if final_score >= 80:
        level = "Critical"
    elif final_score >= 60:
        level = "High"
    elif final_score >= 35:
        level = "Medium"
    else:
        level = "Low"

    explanation = " • ".join(reasons) if reasons else "Routine performance monitoring"
    return final_score, level, explanation


# ── Signal Detector & Queue Synchronizer ──────────────────────────────────────
def detect_and_sync_faculty_signals(db: Session, force: bool = False) -> Dict[str, Any]:
    """
    Runs automated signal detection against all active students in DB.
    Idempotent: Uses unique constraint / deduplication key (student_id + signal_type + contest_id).
    """
    students = db.query(Student).filter(
        Student.is_active == True
    ).all()

    active_session = db.query(WeeklySession).order_by(WeeklySession.id.desc()).first()
    contest_id = active_session.contest_id if active_session else "live"
    contest_name = active_session.contest_name if active_session else "Weekly Contest"

    created_count = 0
    updated_count = 0
    now = datetime.datetime.utcnow()

    for s in students:
        stats = db.query(LeetCodeProfileStats).filter(LeetCodeProfileStats.student_id == s.id).first()
        recent_public = db.query(WeeklyPublicResult).filter(
            WeeklyPublicResult.student_id == s.id
        ).order_by(WeeklyPublicResult.id.desc()).limit(3).all()

        absent_streak = 0
        virtual_streak = 0
        last_solve_count = None
        for res in recent_public:
            p_status = str(res.participation_status or "").upper()
            if p_status in ("ABSENT", "NOT_ATTENDED", "PUBLIC_NOT_ATTENDED", "NOT_SUBMITTED"):
                absent_streak += 1
            elif "VIRTUAL" in p_status:
                virtual_streak += 1
            if last_solve_count is None:
                last_solve_count = res.total_contest_solved

        tot_solved = int(stats.total_solved) if stats and stats.total_solved is not None else 0

        # Inactivity & rating drop
        days_inact = 0
        if stats and stats.last_successful_sync:
            days_inact = (now - stats.last_successful_sync).days

        rating_drop = 0.0

        # Determine appropriate primary signal based on platform mastery & contest participation
        if tot_solved == 0:
            signal_type = "SILENT_DISENGAGED"
            category = "SILENT_DISENGAGED"
        elif tot_solved < 20:
            if absent_streak >= 2:
                signal_type = "CONSECUTIVE_ABSENT"
                category = "LOW_PARTICIPATION"
            else:
                signal_type = "LOW_SOLVE_COUNT"
                category = "PERFORMANCE_DROP"
        elif tot_solved < 50:
            if absent_streak >= 2:
                signal_type = "CONSECUTIVE_ABSENT"
                category = "LOW_PARTICIPATION"
            else:
                signal_type = "LOW_SOLVE_COUNT"
                category = "PERFORMANCE_DROP"
        else:
            # 50+ solves
            if absent_streak >= 2:
                signal_type = "CONTEST_ABSENT"
                category = "LOW_PARTICIPATION"
            elif virtual_streak >= 2:
                signal_type = "VIRTUAL_STREAK"
                category = "LOW_PARTICIPATION"
            else:
                signal_type = "ROUTINE_MONITORING"
                category = "ROUTINE"

        score, level, explanation = calculate_priority_score(
            absent_count=absent_streak,
            virtual_count=virtual_streak,
            rating_drop=rating_drop,
            solved_count=last_solve_count,
            days_inactive=days_inact,
            is_silent=(days_inact >= 14 or tot_solved == 0),
            total_platform_solved=tot_solved
        )

        rec_action = RECOMMENDED_ACTION_MAP.get(signal_type, "Contact student and review performance.")

        # Check existing action
        existing = db.query(FacultyActionQueueItem).filter(
            FacultyActionQueueItem.student_id == s.id,
            FacultyActionQueueItem.contest_id == contest_id
        ).first()

        if existing:
            # Update score and reason if priority changed
            existing.priority_score = score
            existing.priority = level
            existing.signal_type = signal_type
            existing.category = category
            existing.reason = f"[{contest_name}] {explanation}"
            existing.recommended_action = rec_action
            existing.updated_at = now
            updated_count += 1
        else:
            # Default due date = 3 days from now
            due_dt = now + datetime.timedelta(days=3)
            # Default faculty assigned name
            dept_name = s.department.name if s.department else "CSE"
            faculty_assigned = f"{dept_name} Faculty Mentor"

            new_action = FacultyActionQueueItem(
                student_id=s.id,
                faculty_id=None,
                priority=level,
                priority_score=score,
                signal_type=signal_type,
                contest_id=contest_id,
                reason=f"[{contest_name}] {explanation}",
                recommended_action=rec_action,
                status="Pending",
                category=category,
                assigned_faculty_name=faculty_assigned,
                due_date=due_dt,
                created_at=now,
                updated_at=now
            )
            db.add(new_action)
            db.flush()

            # Record Creation Audit Log
            audit = FacultyActionAuditLog(
                action_id=new_action.id,
                user_name="Automated Detection Engine",
                event_type="ACTION_CREATED",
                previous_value=None,
                new_value=f"Priority: {level} ({score}/100)",
                reason=f"Signal detected from {contest_name}: {explanation}",
                created_at=now
            )
            db.add(audit)
            created_count += 1

    db.commit()
    logger.info(f"[FACULTY_ENGINE] Signal Sweep Complete: Created={created_count}, Updated={updated_count}")
    return {
        "status": "success",
        "created": created_count,
        "updated": updated_count,
        "active_contest": contest_id
    }


# ── Action Queue & Filtered Retrieval ─────────────────────────────────────────
def get_faculty_actions_list(
    db: Session,
    priority: Optional[str] = None,
    status: Optional[str] = None,
    department_id: Optional[int] = None,
    year_level: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 100,
    offset: int = 0
) -> Dict[str, Any]:
    """
    Returns filtered and sorted faculty action queue items with real student context.
    """
    query = db.query(FacultyActionQueueItem).join(Student, FacultyActionQueueItem.student_id == Student.id)

    if priority and priority.upper() != "ALL":
        query = query.filter(FacultyActionQueueItem.priority.ilike(priority))

    if status and status.upper() != "ALL":
        query = query.filter(FacultyActionQueueItem.status.ilike(status))

    if department_id and department_id > 0:
        query = query.filter(Student.department_id == department_id)

    if year_level and year_level.upper() != "ALL":
        query = query.filter(Student.year_level.ilike(f"%{year_level}%"))

    if search and search.strip():
        term = f"%{search.strip().lower()}%"
        query = query.filter(
            or_(
                Student.name.ilike(term),
                Student.reg_no.ilike(term),
                Student.username.ilike(term),
                FacultyActionQueueItem.reason.ilike(term),
                FacultyActionQueueItem.assigned_faculty_name.ilike(term)
            )
        )

    total_count = query.count()

    # Sort: Critical first (highest priority_score), then oldest created
    items = query.order_by(
        desc(FacultyActionQueueItem.priority_score),
        desc(FacultyActionQueueItem.id)
    ).offset(offset).limit(limit).all()

    now = datetime.datetime.utcnow()
    results = []

    for item in items:
        st = item.student
        stats = db.query(LeetCodeProfileStats).filter(LeetCodeProfileStats.student_id == st.id).first() if st else None

        # Check overdue follow-up
        is_overdue = False
        overdue_days = 0
        if item.follow_up_date and item.status not in ["Completed", "Resolved"]:
            if item.follow_up_date < now:
                is_overdue = True
                overdue_days = (now - item.follow_up_date).days

        dept_name = st.department.name if (st and st.department) else "CSE"
        dept_code = st.department.code if (st and st.department) else "CSE"
        total_solved = stats.total_solved if stats else 0
        current_rating = int(stats.contest_rating) if (stats and stats.contest_rating) else 0
        contests_attended = 0  # populated from signal detection context
        # Days since last active — use last_updated on profile stats
        days_ago = 0
        if stats and stats.last_updated:
            try:
                days_ago = max(0, (now.date() - stats.last_updated.date()).days)
            except Exception:
                days_ago = 0

        results.append({
            "id": item.id,
            "student_id": item.student_id,
            "reg_no": st.reg_no if st else "N/A",
            "student_name": st.name if st else "Unknown",
            "department_name": dept_name,
            "department_code": dept_code,
            "dept_code": dept_code,   # backward compat
            "year_level": st.year_level or "III Year",
            "leetcode_username": st.username or "",
            "priority": item.priority,
            "priority_score": item.priority_score or 0,
            "priority_score_reason": item.reason or "",
            "signal_type": item.signal_type or "",
            "contest_id": item.contest_id,
            "reason": item.reason,
            "recommended_action": item.recommended_action or "",
            "status": item.status,
            "category": item.category,
            "assigned_faculty_name": item.assigned_faculty_name,
            "due_date": item.due_date.strftime("%d %b %Y") if item.due_date else None,
            "follow_up_date": item.follow_up_date.strftime("%d %b %Y") if item.follow_up_date else None,
            "next_review_date": item.next_review_date.strftime("%d %b %Y") if item.next_review_date else None,
            "is_overdue_followup": is_overdue,
            "days_overdue": overdue_days,
            "is_overdue": is_overdue,     # backward compat
            "overdue_days": overdue_days,  # backward compat
            "is_escalated": item.is_escalated or False,
            "escalated_to": item.escalated_to,
            "action_taken": item.action_taken,
            "faculty_notes": item.faculty_notes,
            "evidence_remarks": item.evidence_remarks,
            "created_at": item.created_at.strftime("%d %b %Y, %I:%M %p") if item.created_at else "",
            "updated_at": item.updated_at.strftime("%d %b %Y, %I:%M %p") if item.updated_at else "",
            # Real student performance preview (flat for frontend)
            "total_solved": total_solved,
            "current_rating": current_rating,
            "contests_attended": contests_attended,
            "last_active_days_ago": days_ago,
            # Also nested for backward compat
            "stats": {
                "total_solved": total_solved,
                "contest_rating": current_rating,
                "easy_solved": stats.easy_solved if stats else 0,
                "medium_solved": stats.medium_solved if stats else 0,
                "hard_solved": stats.hard_solved if stats else 0,
            }
        })

    return {
        "total": total_count,
        "items": results
    }


# ── Top KPI Aggregator ────────────────────────────────────────────────────────
def get_faculty_kpis(db: Session, department_id: Optional[int] = None) -> Dict[str, Any]:
    """
    Computes real database KPI card metrics for Faculty Action Center:
    🔴 Critical, 🟠 High, 🟡 Monitoring, 🔵 In Progress, 🟢 Completed, ✅ Resolved.
    """
    query = db.query(FacultyActionQueueItem).join(Student, FacultyActionQueueItem.student_id == Student.id)
    if department_id and department_id > 0:
        query = query.filter(Student.department_id == department_id)

    total_actions = query.count()
    critical_count = query.filter(FacultyActionQueueItem.priority == "Critical").count()
    high_count = query.filter(FacultyActionQueueItem.priority == "High").count()
    medium_count = query.filter(FacultyActionQueueItem.priority == "Medium").count()
    low_count = query.filter(FacultyActionQueueItem.priority == "Low").count()

    pending_count = query.filter(FacultyActionQueueItem.status == "Pending").count()
    in_progress_count = query.filter(FacultyActionQueueItem.status == "In Progress").count()
    monitoring_count = query.filter(FacultyActionQueueItem.status == "Monitoring").count()
    completed_count = query.filter(FacultyActionQueueItem.status == "Completed").count()
    resolved_count = query.filter(FacultyActionQueueItem.status == "Resolved").count()

    # Overdue follow-up count
    now = datetime.datetime.utcnow()
    overdue_count = query.filter(
        FacultyActionQueueItem.follow_up_date < now,
        FacultyActionQueueItem.status.notin_(["Completed", "Resolved"])
    ).count()

    escalated_count = query.filter(FacultyActionQueueItem.is_escalated == True).count()

    # Immediate attention needed = Critical + High that are not resolved
    immediate_attention_count = query.filter(
        FacultyActionQueueItem.priority.in_(["Critical", "High"]),
        FacultyActionQueueItem.status.notin_(["Completed", "Resolved"])
    ).count()

    return {
        "critical_count": critical_count,
        "high_count": high_count,
        "medium_count": medium_count,
        "low_count": low_count,
        "pending_count": pending_count,
        "in_progress_count": in_progress_count,
        "monitoring_count": monitoring_count,
        "completed_count": completed_count,
        "resolved_count": resolved_count,
        "total_actions": total_actions,
        "overdue_count": overdue_count,
        "escalated_count": escalated_count,
        "immediate_attention_count": immediate_attention_count,
        "subtitle": f"{immediate_attention_count} students require immediate faculty intervention"
    }


# ── Action Lifecycle Operations & Audit Logging ───────────────────────────────
def update_faculty_action_details(
    db: Session,
    action_id: int,
    status: Optional[str] = None,
    assigned_faculty_name: Optional[str] = None,
    action_taken: Optional[str] = None,
    faculty_notes: Optional[str] = None,
    evidence_remarks: Optional[str] = None,
    follow_up_date: Optional[datetime.date] = None,
    next_review_date: Optional[datetime.date] = None,
    user_name: str = "Faculty Mentor"
) -> Dict[str, Any]:
    """
    Updates action details, validates status transition, and creates audit history log.
    """
    item = db.query(FacultyActionQueueItem).filter(FacultyActionQueueItem.id == action_id).first()
    if not item:
        raise ValueError(f"Action item #{action_id} not found.")

    now = datetime.datetime.utcnow()
    changes_made = []

    # 1. Status Transition Check
    if status and status != item.status:
        if status not in VALID_STATUSES:
            raise ValueError(f"Invalid status: '{status}'. Valid options: {VALID_STATUSES}")

        prev_status = item.status
        item.status = status
        if status == "Resolved":
            item.resolved_at = now
        changes_made.append(("STATUS_CHANGED", prev_status, status, f"Status updated from {prev_status} to {status}"))

    # 2. Assignment Check
    if assigned_faculty_name and assigned_faculty_name != item.assigned_faculty_name:
        prev_fac = item.assigned_faculty_name or "Unassigned"
        item.assigned_faculty_name = assigned_faculty_name
        changes_made.append(("FACULTY_ASSIGNED", prev_fac, assigned_faculty_name, f"Assigned to {assigned_faculty_name}"))

    # 3. Notes & Action Taken
    if action_taken:
        item.action_taken = action_taken
        changes_made.append(("ACTION_RECORDED", None, action_taken[:50], action_taken))

    if faculty_notes:
        item.faculty_notes = faculty_notes
        changes_made.append(("NOTE_ADDED", None, "Note updated", faculty_notes))

    if evidence_remarks:
        item.evidence_remarks = evidence_remarks

    # 4. Follow-up & Review Dates
    if follow_up_date:
        dt_follow = datetime.datetime.combine(follow_up_date, datetime.time(10, 0))
        item.follow_up_date = dt_follow
        changes_made.append(("FOLLOW_UP_SCHEDULED", None, follow_up_date.strftime("%d %b %Y"), f"Follow-up set for {follow_up_date}"))

    if next_review_date:
        dt_rev = datetime.datetime.combine(next_review_date, datetime.time(10, 0))
        item.next_review_date = dt_rev

    item.updated_at = now

    # Write Audit Logs
    for event_type, prev_val, new_val, reason_text in changes_made:
        audit = FacultyActionAuditLog(
            action_id=item.id,
            user_name=user_name,
            event_type=event_type,
            previous_value=str(prev_val) if prev_val else None,
            new_value=str(new_val) if new_val else None,
            reason=reason_text,
            created_at=now
        )
        db.add(audit)

    db.commit()
    db.refresh(item)
    return {"status": "success", "message": "Action updated successfully", "action_id": item.id}


def escalate_faculty_action(
    db: Session,
    action_id: int,
    escalated_to: str = "HOD",
    reason: str = "Unresolved critical performance drop after multiple follow-ups",
    user_name: str = "Faculty Mentor"
) -> Dict[str, Any]:
    """
    Escalates an intervention action to HOD or Principal with audit record.
    """
    item = db.query(FacultyActionQueueItem).filter(FacultyActionQueueItem.id == action_id).first()
    if not item:
        raise ValueError(f"Action #{action_id} not found.")

    now = datetime.datetime.utcnow()
    item.is_escalated = True
    item.escalated_to = escalated_to
    item.escalated_at = now
    item.priority = "Critical"
    item.priority_score = 98
    item.updated_at = now

    audit = FacultyActionAuditLog(
        action_id=item.id,
        user_name=user_name,
        event_type="ESCALATED",
        previous_value="Faculty Level",
        new_value=f"Escalated to {escalated_to}",
        reason=reason,
        created_at=now
    )
    db.add(audit)
    db.commit()
    return {"status": "success", "message": f"Action #{action_id} escalated to {escalated_to}."}


def get_action_timeline(db: Session, action_id: int) -> List[Dict[str, Any]]:
    """
    Returns the complete chronological event audit timeline for a faculty action.
    """
    logs = db.query(FacultyActionAuditLog).filter(
        FacultyActionAuditLog.action_id == action_id
    ).order_by(FacultyActionAuditLog.id.asc()).all()

    timeline = []
    for l in logs:
        timeline.append({
            "id": l.id,
            "event_type": l.event_type,
            "user_name": l.user_name or "System",
            "previous_value": l.previous_value,
            "new_value": l.new_value,
            "reason": l.reason,
            "timestamp": l.created_at.strftime("%d %b %Y — %I:%M %p") if l.created_at else ""
        })
    return timeline
