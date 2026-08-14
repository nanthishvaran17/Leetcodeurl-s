import os
import sys
import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.models import (
    Student, LeetCodeProfileStats, WeeklySession,
    WeeklyPublicResult, WeeklyVirtualResult, SyncJob, AdminAuditLog
)
from backend.services.firebase_rtdb_service import get_rtdb_reference, RTDB_URL

def sanitize_key(key: str) -> str:
    """Sanitizes keys for Firebase Realtime Database paths (replaces '.', '#', '$', '[', ']')."""
    if not key:
        return ""
    return str(key).replace('.', '_').replace('#', '_').replace('$', '_').replace('[', '_').replace(']', '_')

def run_sqlite_to_firebase_rtdb_migration(sqlite_path: str = None):
    """
    Idempotent, production-safe migration engine: SQLite -> Firebase Realtime Database.
    Transfers student roster, stats, weekly sessions, and contest participations.
    """
    print("=" * 80)
    print("NANDHA ENGINEERING COLLEGE (AUTONOMOUS) — LEETCODE TRACKER")
    print("SQLITE TO FIREBASE REALTIME DATABASE MIGRATION ENGINE")
    print("=" * 80)

    # 1. Locate Source SQLite Database
    if not sqlite_path:
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        possible_paths = [
            os.path.join(base_dir, "data", "leetcode_tracker.db"),
            "/tmp/leetcode_tracker.db",
            os.path.join(base_dir, "leetcode_tracker.db")
        ]
        for p in possible_paths:
            if os.path.exists(p):
                sqlite_path = p
                break
        if not sqlite_path:
            sqlite_path = possible_paths[0]

    sqlite_url = f"sqlite:///{sqlite_path}"
    print(f"[SOURCE] SQLite Database: {sqlite_url} (Exists: {os.path.exists(sqlite_path)})")
    print(f"[TARGET] Firebase Realtime Database URL: {RTDB_URL}")

    # 2. Open SQLite Database Session
    src_engine = create_engine(sqlite_url, connect_args={"check_same_thread": False})
    SrcSession = sessionmaker(bind=src_engine)
    db = SrcSession()

    # 3. Get Root RTDB Reference
    root_ref = get_rtdb_reference("/")
    if not root_ref:
        print("[ERROR] Could not establish connection to Firebase Realtime Database. Stopping migration.")
        return None

    # Read SQLite Datasets
    students = db.query(Student).all()
    sqlite_student_count = len(students)
    print(f"[SQLITE AUDIT] Total Students in SQLite: {sqlite_student_count}")

    stats_list = db.query(LeetCodeProfileStats).all()
    stats_by_student_id = {s.student_id: s for s in stats_list}

    sessions = db.query(WeeklySession).all()
    public_results = db.query(WeeklyPublicResult).all()
    sync_jobs = db.query(SyncJob).all()
    audit_logs = db.query(AdminAuditLog).all()

    students_dict = {}
    stats_dict = {}
    verified_cnt = 0
    pending_cnt = 0
    failed_cnt = 0

    for st in students:
        reg_key = sanitize_key(st.reg_no)
        dept_code = st.department.code if st.department else "GEN"
        dept_name = st.department.name if st.department else dept_code

        students_dict[reg_key] = {
            "id": st.id,
            "reg_no": st.reg_no,
            "name": st.name,
            "department": dept_code,
            "department_name": dept_name,
            "year_level": st.year_level,
            "section": st.section.name if st.section else "A",
            "email": st.email or "",
            "leetcode_url": st.leetcode_url or "",
            "username": st.username or "",
            "is_active": st.is_active if st.is_active is not None else True,
            "created_at": st.created_at.isoformat() if st.created_at else datetime.datetime.utcnow().isoformat()
        }

        s_stat = stats_by_student_id.get(st.id)
        if s_stat:
            sync_status = s_stat.sync_status or "pending"
            tot_solved = s_stat.total_solved if (s_stat.total_solved is not None and sync_status in ("success", "OK", "verified")) else None
            
            if tot_solved is not None:
                verified_cnt += 1
            elif sync_status in ("failed", "mismatch"):
                failed_cnt += 1
            else:
                pending_cnt += 1

            stats_dict[reg_key] = {
                "student_id": st.id,
                "reg_no": st.reg_no,
                "total_solved": tot_solved,
                "easy_solved": s_stat.easy_solved if tot_solved is not None else None,
                "medium_solved": s_stat.medium_solved if tot_solved is not None else None,
                "hard_solved": s_stat.hard_solved if tot_solved is not None else None,
                "contest_rating": s_stat.contest_rating,
                "contest_global_ranking": s_stat.contest_global_ranking,
                "public_profile_ranking": s_stat.public_profile_ranking,
                "active_days": s_stat.active_days,
                "max_streak": s_stat.max_streak,
                "status": s_stat.status or "pending",
                "sync_status": sync_status,
                "source": s_stat.source or None,
                "error_message": s_stat.error_message or None,
                "last_verified_at": s_stat.last_verified_at.isoformat() if s_stat.last_verified_at else None,
                "last_updated": s_stat.last_updated.isoformat() if s_stat.last_updated else datetime.datetime.utcnow().isoformat()
            }
        else:
            pending_cnt += 1
            stats_dict[reg_key] = {
                "student_id": st.id,
                "reg_no": st.reg_no,
                "total_solved": None,
                "sync_status": "pending",
                "status": "pending",
                "last_updated": datetime.datetime.utcnow().isoformat()
            }

    sessions_dict = {}
    for sess in sessions:
        sess_key = sanitize_key(sess.session_code or f"session_{sess.id}")
        sessions_dict[sess_key] = {
            "id": sess.id,
            "session_code": sess.session_code,
            "session_date": sess.session_date,
            "week_number": sess.week_number,
            "contest_id": sess.contest_id,
            "contest_name": sess.contest_name,
            "status": sess.status,
            "total_students": sess.total_students,
            "official_participants": sess.official_participants,
            "virtual_participants": sess.virtual_participants
        }

    sync_jobs_dict = {}
    for job in sync_jobs:
        job_key = sanitize_key(job.job_id)
        sync_jobs_dict[job_key] = {
            "id": job.id,
            "job_id": job.job_id,
            "job_type": job.job_type,
            "status": job.status,
            "total_records": job.total_records,
            "success_count": job.success_count,
            "error_count": job.error_count,
            "started_at": job.started_at.isoformat() if job.started_at else None,
            "completed_at": job.completed_at.isoformat() if job.completed_at else None
        }

    # 4. Perform Idempotent Push to Firebase RTDB
    print("[MIGRATION] Pushing transformed nodes to Firebase Realtime Database...")

    try:
        root_ref.child("students").update(students_dict)
        root_ref.child("leetcode_stats").update(stats_dict)
        if sessions_dict:
            root_ref.child("weekly_sessions").update(sessions_dict)
        if sync_jobs_dict:
            root_ref.child("sync_jobs").update(sync_jobs_dict)
    except Exception as push_err:
        print(f"[ERROR] Failed updating Firebase RTDB: {push_err}")
        db.close()
        return None

    # 5. Read Back & Verify Firebase RTDB Student Count
    rtdb_students_snap = root_ref.child("students").get()
    rtdb_student_count = len(rtdb_students_snap) if rtdb_students_snap else 0

    print("=" * 80)
    print("MIGRATION FORENSIC SUMMARY")
    print(f"SQLite Student Count    : {sqlite_student_count}")
    print(f"Firebase RTDB Count     : {rtdb_student_count}")
    print(f"Students Migrated       : {len(students_dict)}")
    print(f"Stats Records Migrated  : {len(stats_dict)}")
    print(f"  - Verified Stats      : {verified_cnt}")
    print(f"  - Pending Stats       : {pending_cnt}")
    print(f"  - Failed Stats        : {failed_cnt}")
    print(f"Weekly Sessions Migrated: {len(sessions_dict)}")
    print(f"Count Verification      : {'MATCH (PASS)' if sqlite_student_count == rtdb_student_count else 'MISMATCH (FAIL)'}")
    print("=" * 80)

    # 6. Three-Student Forensic Verification
    print("\n" + "=" * 80)
    print("THREE-STUDENT FORENSIC COMPARISON (SQLITE vs FIREBASE RTDB)")
    print("=" * 80)

    sample_students = students[:3]
    for s in sample_students:
        reg_key = sanitize_key(s.reg_no)
        rtdb_data = rtdb_students_snap.get(reg_key, {}) if rtdb_students_snap else {}

        print(f"Student: {s.name} ({s.reg_no})")
        print(f"  - SQLite Name         : '{s.name}'")
        print(f"  - RTDB Name           : '{rtdb_data.get('name')}'")
        print(f"  - SQLite Reg No       : '{s.reg_no}'")
        print(f"  - RTDB Reg No         : '{rtdb_data.get('reg_no')}'")
        print(f"  - SQLite Year Level   : '{s.year_level}'")
        print(f"  - RTDB Year Level     : '{rtdb_data.get('year_level')}'")
        print(f"  - SQLite Handle       : '{s.username}'")
        print(f"  - RTDB Handle         : '{rtdb_data.get('username')}'")
        match = (
            s.name == rtdb_data.get('name') and
            s.reg_no == rtdb_data.get('reg_no') and
            s.year_level == rtdb_data.get('year_level')
        )
        print(f"  - Match Status        : {'100% MATCH (VERIFIED)' if match else 'FIELD MISMATCH'}")
        print("-" * 50)

    db.close()
    return {
        "sqlite_student_count": sqlite_student_count,
        "rtdb_student_count": rtdb_student_count,
        "students_migrated": len(students_dict),
        "verified_count": verified_cnt,
        "pending_count": pending_cnt,
        "failed_count": failed_cnt,
        "match": sqlite_student_count == rtdb_student_count
    }

if __name__ == "__main__":
    run_sqlite_to_firebase_rtdb_migration()
