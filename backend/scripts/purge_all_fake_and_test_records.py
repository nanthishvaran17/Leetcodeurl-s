import os
import sys
import sqlite3

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from backend.database import engine, SessionLocal
from backend.models import Student, WeeklySession, WeeklyPublicResult
from backend.cache import cache
from backend.services.canonical_contest_engine import invalidate_canonical_cache

def purge_all_fake_records():
    print("=" * 80)
    print("PURGING ALL FAKE, DUMMY, TEST AND CONCURRENT RECORDS FROM SYSTEM")
    print("=" * 80)

    db = SessionLocal()
    raw_conn = engine.raw_connection()
    cursor = raw_conn.cursor()

    try:
        cursor.execute("PRAGMA foreign_keys = OFF;")

        # 1. Identify fake students
        cursor.execute("SELECT id, reg_no, name FROM students")
        all_students = cursor.fetchall()
        
        fake_student_ids = []
        real_student_ids = []

        for sid, reg, name in all_students:
            reg_clean = (reg or "").upper().strip()
            name_clean = (name or "").upper().strip()

            is_fake = False
            if not reg_clean:
                is_fake = True
            elif reg_clean.startswith(("TEST", "CONCUR", "HARDENING", "7322STU", "REG_", "NOTIF_", "P930_", "7322P930")):
                is_fake = True
            elif "TEST" in reg_clean or "DUMMY" in reg_clean:
                is_fake = True
            elif any(w in name_clean for w in ["TEST", "DUMMY", "CONCURRENT", "PROFILE ONLY", "HARDENING", "SOLVER"]):
                is_fake = True

            if is_fake:
                fake_student_ids.append(sid)
            else:
                real_student_ids.append(sid)

        print(f"Total students in DB before purge: {len(all_students)}")
        print(f"Identified Fake/Test Students: {len(fake_student_ids)}")
        print(f"Identified Genuine College Students: {len(real_student_ids)}")

        if fake_student_ids:
            placeholders = ",".join("?" for _ in fake_student_ids)

            # All tables referencing student_id
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = [r[0] for r in cursor.fetchall() if not r[0].startswith("sqlite_")]

            total_deleted_children = 0
            for t in tables:
                cursor.execute(f"PRAGMA table_info({t})")
                cols = [c[1] for c in cursor.fetchall()]
                if "student_id" in cols:
                    try:
                        cursor.execute(f"DELETE FROM {t} WHERE student_id IN ({placeholders})", fake_student_ids)
                        cnt = cursor.rowcount
                        if cnt > 0:
                            total_deleted_children += cnt
                            print(f"  - Deleted {cnt} orphaned records from '{t}'")
                    except Exception as err:
                        print(f"  Warning on table {t}: {err}")

            cursor.execute(f"DELETE FROM students WHERE id IN ({placeholders})", fake_student_ids)
            print(f"-> Successfully purged {len(fake_student_ids)} fake students from 'students' table.")

        # 2. Purge fake test users (Staff / Admin test accounts)
        genuine_emails = {
            "nanthishvaran17@gmail.com",
            "nanthishvaran0106@gmail.com",
            "nanthishsaravanan17@gmail.com",
            "nanthishvaran117@gmail.com",
            "nanthishvaran3636@gmail.com",
            "msanthoshkumar@nandhaengg.org",
            "santhoshkumar@nandhaengg.org",
            "sharma@nandhaengg.org"
        }

        cursor.execute("SELECT id, username, email, role FROM users")
        all_users = cursor.fetchall()
        fake_user_ids = []
        for uid, uname, email, role in all_users:
            em = (email or "").strip().lower()
            un = (uname or "").strip().lower()
            if em not in genuine_emails and (
                "test" in em or "test" in un or
                "isolation" in em or "isolation" in un or
                "hardening" in em or "hardening" in un or
                "p930" in em or "p930" in un or
                "notif" in em or "notif" in un or
                "dummy" in em or "dummy" in un or
                em.endswith(".test") or em.endswith("@college.edu") or
                un.startswith("staff_") or un.startswith("test_") or
                role == "Deleted_Staff"
            ):
                fake_user_ids.append(uid)

        print(f"\nIdentified Fake/Test Users: {len(fake_user_ids)}")
        if fake_user_ids:
            u_placeholders = ",".join("?" for _ in fake_user_ids)
            for t in ["admin_sessions", "security_activity_logs", "audit_logs", "mentor_notes", 
                      "staff_follow_ups", "staff_alerts", "faculty_student_assignments", 
                      "student_assignment_history", "hod_department_allocations"]:
                try:
                    for col in ["user_id", "faculty_id", "staff_id"]:
                        cursor.execute(f"PRAGMA table_info({t})")
                        cols = [c[1] for c in cursor.fetchall()]
                        if col in cols:
                            cursor.execute(f"DELETE FROM {t} WHERE {col} IN ({u_placeholders})", fake_user_ids)
                except Exception:
                    pass
            cursor.execute(f"DELETE FROM users WHERE id IN ({u_placeholders})", fake_user_ids)
            print(f"-> Successfully purged {len(fake_user_ids)} fake users from 'users' table.")

        cursor.execute("PRAGMA foreign_keys = ON;")
        raw_conn.commit()

        # 3. Synchronize WeeklySession metadata to genuine count (569)
        real_count = len(real_student_ids)
        cursor.execute("SELECT id, contest_name FROM weekly_sessions")
        sessions = cursor.fetchall()
        for sess_id, cname in sessions:
            cursor.execute("SELECT COUNT(*) FROM weekly_public_results WHERE session_id = ? AND participation_status = 'PUBLIC'", (sess_id,))
            row = cursor.fetchone()
            pub_cnt = row[0] if row else 0
            not_att = max(0, real_count - pub_cnt)
            cursor.execute("""
                UPDATE weekly_sessions 
                SET total_students = ?, 
                    official_participants = ?, 
                    not_participated = ?,
                    failed_verification = 0
                WHERE id = ?
            """, (real_count, pub_cnt, not_att, sess_id))

        raw_conn.commit()
        print(f"-> Synchronized all WeeklySession total_students to genuine count: {real_count}")

        # Invalidate caches
        invalidate_canonical_cache(None)
        cache.clear()
        print("\nAll application and contest caches purged.")

        # Verification summary
        cursor.execute("SELECT COUNT(*) FROM students")
        row_tot = cursor.fetchone()
        final_total = row_tot[0] if row_tot else 0
        cursor.execute("SELECT COUNT(*) FROM students WHERE is_active = 1")
        row_act = cursor.fetchone()
        final_active = row_act[0] if row_act else 0
        print(f"\nVERIFICATION FINAL TALLY:")
        print(f"  Total Students in Database: {final_total}")
        print(f"  Active Genuine Students:    {final_active}")

        cursor.execute("""
            SELECT d.code, COUNT(s.id) 
            FROM departments d 
            JOIN students s ON s.department_id = d.id 
            GROUP BY d.code 
            ORDER BY COUNT(s.id) DESC
        """)
        print("\nDepartment Breakdown of Genuine Students:")
        for code, count in cursor.fetchall():
            print(f"  {code}: {count} students")

    except Exception as e:
        raw_conn.rollback()
        print(f"Error during purge: {e}")
        import traceback
        traceback.print_exc()
    finally:
        raw_conn.close()
        db.close()

if __name__ == "__main__":
    purge_all_fake_records()
