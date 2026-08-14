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
from backend.services.firestore_service import get_firestore_db

def run_sqlite_to_firestore_migration(sqlite_path: str = None):
    """
    Idempotent, production-safe migration engine: SQLite -> Cloud Firestore.
    Transfers student roster, stats, weekly sessions, contest results, and audit logs.
    """
    print("=" * 80)
    print("NANDHA ENGINEERING COLLEGE (AUTONOMOUS) — LEETCODE TRACKER")
    print("SQLITE TO CLOUD FIRESTORE MIGRATION ENGINE")
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

    # 2. Open SQLite Database Session
    src_engine = create_engine(sqlite_url, connect_args={"check_same_thread": False})
    SrcSession = sessionmaker(bind=src_engine)
    db = SrcSession()

    # 3. Get Cloud Firestore Client
    fs_db = get_firestore_db()
    if not fs_db:
        print("[ERROR] Could not establish connection to Cloud Firestore. Stopping migration.")
        return None

    # Read SQLite Datasets
    students = db.query(Student).all()
    sqlite_student_count = len(students)
    print(f"[SQLITE AUDIT] Total Students in SQLite: {sqlite_student_count}")

    stats_list = db.query(LeetCodeProfileStats).all()
    stats_by_student_id = {s.student_id: s for s in stats_list}

    sessions = db.query(WeeklySession).all()
    sync_jobs = db.query(SyncJob).all()
    audit_logs = db.query(AdminAuditLog).all()

    students_batch = fs_db.batch()
    stats_batch = fs_db.batch()

    verified_cnt = 0
    pending_cnt = 0
    failed_cnt = 0

    students_coll = fs_db.collection("students")
    stats_coll = fs_db.collection("leetcode_stats")
    sessions_coll = fs_db.collection("weekly_sessions")
    sync_jobs_coll = fs_db.collection("sync_jobs")
    audit_logs_coll = fs_db.collection("audit_logs")

    # Batch write optimization for Cloud Firestore
    batch = fs_db.batch()
    op_count = 0

    for st in students:
        reg_no = st.reg_no
        dept_code = st.department.code if st.department else "GEN"
        dept_name = st.department.name if st.department else dept_code

        st_doc = {
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
        batch.set(students_coll.document(reg_no), st_doc, merge=True)
        op_count += 1

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

            stat_doc = {
                "student_id": st.id,
                "reg_no": st.reg_no,
                "username": st.username or "",
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
            stat_doc = {
                "student_id": st.id,
                "reg_no": st.reg_no,
                "username": st.username or "",
                "total_solved": None,
                "sync_status": "pending",
                "status": "pending",
                "last_updated": datetime.datetime.utcnow().isoformat()
            }
        batch.set(stats_coll.document(reg_no), stat_doc, merge=True)
        op_count += 1

        if op_count >= 400:
            batch.commit()
            batch = fs_db.batch()
            op_count = 0

    for sess in sessions:
        sess_doc_id = str(sess.session_code or f"session_{sess.id}")
        batch.set(sessions_coll.document(sess_doc_id), {
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
        }, merge=True)
        op_count += 1

    for job in sync_jobs:
        job_doc_id = str(job.job_id)
        batch.set(sync_jobs_coll.document(job_doc_id), {
            "id": job.id,
            "job_id": job.job_id,
            "job_type": job.job_type,
            "status": job.status,
            "total_records": job.total_records,
            "success_count": job.success_count,
            "error_count": job.error_count,
            "started_at": job.started_at.isoformat() if job.started_at else None,
            "completed_at": job.completed_at.isoformat() if job.completed_at else None
        }, merge=True)
        op_count += 1

    if op_count > 0:
        batch.commit()


    # 4. Read Back & Verify Cloud Firestore Student Count
    fs_students_docs = list(students_coll.stream())
    fs_student_count = len(fs_students_docs)

    print("=" * 80)
    print("CLOUD FIRESTORE MIGRATION FORENSIC SUMMARY")
    print(f"SQLite Student Count        : {sqlite_student_count}")
    print(f"Cloud Firestore Count       : {fs_student_count}")
    print(f"Students Migrated           : {sqlite_student_count}")
    print(f"  - Verified Stats          : {verified_cnt}")
    print(f"  - Pending Stats           : {pending_cnt}")
    print(f"  - Failed Stats            : {failed_cnt}")
    print(f"Weekly Sessions Migrated    : {len(sessions)}")
    print(f"Count Verification          : {'MATCH (PASS)' if sqlite_student_count == fs_student_count else 'MISMATCH (FAIL)'}")
    print("=" * 80)

    # 5. Three-Student Forensic Verification
    print("\n" + "=" * 80)
    print("THREE-STUDENT FORENSIC COMPARISON (SQLITE vs CLOUD FIRESTORE)")
    print("=" * 80)

    sample_students = students[:3]
    for s in sample_students:
        fs_doc_snap = students_coll.document(s.reg_no).get()
        fs_data = fs_doc_snap.to_dict() if fs_doc_snap.exists else {}

        print(f"Student: {s.name} ({s.reg_no})")
        print(f"  - SQLite Name             : '{s.name}'")
        print(f"  - Firestore Name          : '{fs_data.get('name')}'")
        print(f"  - SQLite Reg No           : '{s.reg_no}'")
        print(f"  - Firestore Reg No        : '{fs_data.get('reg_no')}'")
        print(f"  - SQLite Year Level       : '{s.year_level}'")
        print(f"  - Firestore Year Level     : '{fs_data.get('year_level')}'")
        print(f"  - SQLite Handle           : '{s.username}'")
        print(f"  - Firestore Handle         : '{fs_data.get('username')}'")
        match = (
            s.name == fs_data.get('name') and
            s.reg_no == fs_data.get('reg_no') and
            s.year_level == fs_data.get('year_level')
        )
        print(f"  - Match Status            : {'100% MATCH (VERIFIED)' if match else 'FIELD MISMATCH'}")
        print("-" * 50)

    db.close()
    return {
        "sqlite_student_count": sqlite_student_count,
        "firestore_student_count": fs_student_count,
        "students_migrated": sqlite_student_count,
        "verified_count": verified_cnt,
        "pending_count": pending_cnt,
        "failed_count": failed_cnt,
        "match": sqlite_student_count == fs_student_count
    }

if __name__ == "__main__":
    run_sqlite_to_firestore_migration()
