import os
import sys
import datetime

# Add project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.database import SessionLocal
from backend.models import Student, LeetCodeProfileStats, WeeklyStudentProgress, Department, Section

def get_firestore_client():
    """
    Safely initialize Firebase Admin SDK and return Firestore client if credentials exist.
    """
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore

        if not firebase_admin._apps:
            sa_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "serviceAccountKey.json")
            if os.path.exists(sa_path):
                cred = credentials.Certificate(sa_path)
                firebase_admin.initialize_app(cred)
            elif os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
                cred = credentials.ApplicationDefault()
                firebase_admin.initialize_app(cred)
            else:
                return None
        return firestore.client()
    except Exception as err:
        print(f"Firestore Admin SDK notice: {err}")
        return None

def sync_database_to_firestore():
    """
    Export / Sync SQLite student statistics & pre-calculated aggregations into Firestore.
    Collections updated:
      - students/{studentId}
      - leetcodeStats/{studentId}
      - leaderboard/current
      - collegeStats/current
      - departmentStats/{deptCode}
      - dataQuality/current
    """
    print("Starting sync of SQLite student records & pre-calculated aggregations to Firestore...")
    db = SessionLocal()
    fs_db = get_firestore_client()

    try:
        students = db.query(Student).filter(Student.is_active == True).all()
        total_students = len(students)
        print(f"Loaded {total_students} active student records from database.")

        active_count = 0
        total_solved_sum = 0
        weekly_progress_sum = 0
        valid_profiles = 0
        missing_links = 0
        invalid_links = 0

        leaderboard_items = []
        dept_summary = {}

        synced_count = 0
        for s in students:
            stats = s.stats
            prog = db.query(WeeklyStudentProgress).filter(
                WeeklyStudentProgress.student_id == s.id
            ).order_by(WeeklyStudentProgress.id.desc()).first()

            total_solved = stats.total_solved if (stats and stats.total_solved is not None) else None
            if total_solved is not None:
                total_solved_sum += total_solved
                if total_solved > 0:
                    active_count += 1

            weekly_prog = prog.weekly_progress if (prog and prog.weekly_progress) else 0
            weekly_progress_sum += weekly_prog

            status = stats.status if stats else "NOT STARTED"
            if status in ("OK", "success"):
                valid_profiles += 1
            elif status in ("MISSING LINK", "MISSING_LINK"):
                missing_links += 1
            elif status in ("INVALID LINK", "INVALID_LINK"):
                invalid_links += 1

            dept_code = s.department.code if s.department else "GEN"
            dept_name = s.department.name if s.department else "General"
            if dept_code not in dept_summary:
                dept_summary[dept_code] = {
                    "department_code": dept_code,
                    "department_name": dept_name,
                    "total_students": 0,
                    "active_students": 0,
                    "total_solved": 0,
                    "weekly_progress": 0,
                    "top_student_name": "N/A",
                    "top_solved": 0
                }

            dept_summary[dept_code]["total_students"] += 1
            dept_summary[dept_code]["total_solved"] += (total_solved or 0)
            dept_summary[dept_code]["weekly_progress"] += weekly_prog
            if total_solved and total_solved > 0:
                dept_summary[dept_code]["active_students"] += 1
            if total_solved and total_solved > dept_summary[dept_code]["top_solved"]:
                dept_summary[dept_code]["top_solved"] = total_solved
                dept_summary[dept_code]["top_student_name"] = s.name

            # Student Document payload
            student_doc = {
                "id": s.id,
                "registerNo": s.reg_no,
                "name": s.name,
                "email": s.email or "",
                "department": dept_code,
                "departmentName": dept_name,
                "year": s.year_level,
                "section": s.section.name if s.section else "A",
                "leetcodeUsername": s.username or "",
                "leetcodeProfileUrl": s.leetcode_url or "",
                "isActive": s.is_active
            }

            # Determine sync status cleanly
            if stats and stats.sync_status:
                sync_st = stats.sync_status
            elif stats and stats.status in ("OK", "success") and total_solved is not None:
                sync_st = "success"
            elif status in ("INVALID LINK", "MISSING LINK", "INVALID_LINK", "MISSING_LINK"):
                sync_st = "invalid_profile"
            else:
                sync_st = "pending"

            # LeetCode Stats Document payload — only set fields that have real values
            last_ver = stats.last_verified_at.isoformat() if (stats and stats.last_verified_at) else None
            last_att = stats.last_attempt_at.isoformat() if (stats and getattr(stats, 'last_attempt_at', None)) else None

            stats_doc = {
                "studentId": s.id,
                "registerNo": s.reg_no,
                "leetcodeUsername": s.username or "",
                "totalSolved": total_solved,  # null when not yet fetched
                "easySolved": stats.easy_solved if (stats and stats.easy_solved is not None) else None,
                "mediumSolved": stats.medium_solved if (stats and stats.medium_solved is not None) else None,
                "hardSolved": stats.hard_solved if (stats and stats.hard_solved is not None) else None,
                "contestRating": stats.contest_rating if stats else None,
                "globalRanking": stats.public_profile_ranking if stats else None,
                "status": status,
                "syncStatus": sync_st,
                "validationStatus": getattr(stats, 'validation_status', None) if stats else None,
                "source": stats.source if (stats and stats.source) else None,
                "lastVerifiedAt": last_ver,
                "lastAttemptAt": last_att,
                "errorCode": getattr(stats, 'error_code', None) if stats else None,
                "retryCount": getattr(stats, 'retry_count', 0) if stats else 0,
                "weeklySolved": weekly_prog,
                "streakCount": prog.streak_count if prog else 0,
                "consistencyScore": prog.consistency_score if prog else 0.0,
                "collegeRank": prog.college_rank if prog else None
            }

            # Only include verified students in the leaderboard — Rule 16
            is_verified_for_lb = (
                stats and
                stats.sync_status in ("success", "OK") and
                getattr(stats, 'validation_status', None) in ("verified", None) and  # None for backward compat
                total_solved is not None
            )
            if is_verified_for_lb:
                leaderboard_items.append({
                    "rank": prog.college_rank if (prog and prog.college_rank) else 9999,
                    "studentId": s.id,
                    "name": s.name,
                    "registerNo": s.reg_no,
                    "department": dept_code,
                    "section": s.section.name if s.section else "A",
                    "totalSolved": total_solved,
                    "contestRating": stats.contest_rating if stats else None,
                    "weeklyProgress": weekly_prog
                })

            if fs_db:
                try:
                    fs_db.collection("students").document(str(s.id)).set(student_doc, merge=True)
                    fs_db.collection("leetcodeStats").document(str(s.id)).set(stats_doc, merge=True)
                except Exception as ex:
                    print(f"Error syncing student {s.id} to Cloud Firestore: {ex}")

            synced_count += 1

        # Calculate Aggregations
        leaderboard_items.sort(key=lambda x: (x["rank"], -x["totalSolved"]))
        top_10_leaderboard = leaderboard_items[:10]

        college_kpis = {
            "total_students": total_students,
            "active_students": active_count,
            "not_started_students": total_students - active_count,
            "total_problems_solved": total_solved_sum,
            "average_weekly_progress": round(weekly_progress_sum / max(1, total_students), 1),
            "participation_rate": round((active_count / max(1, total_students)) * 100, 1),
            "last_updated": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }

        data_quality_kpis = {
            "total_students": total_students,
            "valid_profiles": valid_profiles,
            "missing_links": missing_links,
            "invalid_links": invalid_links,
            "health_score_percentage": round((valid_profiles / max(1, total_students)) * 100, 1),
            "last_sync": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }

        # Format Department Aggregations
        dept_list = []
        for code, info in dept_summary.items():
            tot = info["total_students"]
            dept_list.append({
                "department_code": code,
                "department_name": info["department_name"],
                "total_students": tot,
                "active_students": info["active_students"],
                "participation_rate": round((info["active_students"] / max(1, tot)) * 100, 1),
                "avg_solved": round(info["total_solved"] / max(1, tot), 1),
                "avg_progress": round(info["weekly_progress"] / max(1, tot), 1),
                "top_student_name": info["top_student_name"]
            })

        if fs_db:
            try:
                fs_db.collection("collegeStats").document("current").set(college_kpis, merge=True)
                fs_db.collection("leaderboard").document("current").set({"top_10": top_10_leaderboard}, merge=True)
                fs_db.collection("dataQuality").document("current").set(data_quality_kpis, merge=True)
                for d in dept_list:
                    fs_db.collection("departmentStats").document(d["department_code"]).set(d, merge=True)

                # Push growthStats/current
                from backend.routes.history import get_top_improvers, get_college_delta
                try:
                    top_improvers_7d = [imp.dict() for imp in get_top_improvers(period="7d", limit=10, db=db)]
                    delta_7d = get_college_delta(period="7d", db=db)
                    fs_db.collection("growthStats").document("current").set({
                        "top_improvers_7d": top_improvers_7d,
                        "college_delta_7d": delta_7d,
                        "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
                    }, merge=True)
                except Exception as imp_err:
                    print(f"Notice: growthStats calculation error: {imp_err}")

                # Push riskSummary/current
                from backend.routes.risk import get_risk_summary
                try:
                    risk_summary = get_risk_summary(db=db)
                    fs_db.collection("riskSummary").document("current").set({
                        "counts": risk_summary,
                        "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
                    }, merge=True)
                except Exception as risk_err:
                    print(f"Notice: riskSummary calculation error: {risk_err}")

                print("Cloud Firestore pre-calculated aggregations successfully updated!")
            except Exception as ex:
                print(f"Error syncing Cloud Firestore aggregations: {ex}")

        print(f"Successfully processed & verified {synced_count} student statistics records and pre-calculated aggregations.")
    finally:
        db.close()

if __name__ == "__main__":
    sync_database_to_firestore()


def initialize_pending_records():
    """
    Ensures ALL active students have a Firestore document in leetcodeStats/{studentId}.
    For students who have never been successfully synced, writes:
        { syncStatus: "pending", totalSolved: null, lastVerifiedAt: null }
    This prevents the frontend from showing "0 Solved / Verified just now" for unfetched students.
    Call this on server startup (non-blocking).
    """
    fs_db = get_firestore_client()
    if not fs_db:
        print("[Firestore Init] Firestore not available — skipping pending record initialization.")
        return

    db = SessionLocal()
    try:
        students = db.query(Student).filter(
            (Student.is_active == True) | (Student.is_active.is_(None))
        ).all()

        initialized = 0
        skipped = 0
        for s in students:
            # Always use str(s.id) as the Firestore document ID — consistent with sync_database_to_firestore
            student_doc_id = str(s.id)
            try:
                doc_ref = fs_db.collection("leetcodeStats").document(student_doc_id)
                doc = doc_ref.get()
                if not doc.exists:
                    # New student — write pending placeholder
                    doc_ref.set({
                        "studentId":       s.id,
                        "registerNo":      s.reg_no,
                        "leetcodeUsername": s.username or None,
                        "syncStatus":      "pending",
                        "validationStatus": "pending",
                        "source":          None,
                        "totalSolved":     None,
                        "easySolved":      None,
                        "mediumSolved":    None,
                        "hardSolved":      None,
                        "contestRating":   None,
                        "globalRank":      None,
                        "lastVerifiedAt":  None,
                        "lastAttemptAt":   None,
                        "errorCode":       None,
                        "retryCount":      0,
                    })
                    initialized += 1
                else:
                    existing = doc.to_dict()
                    # Only overwrite if syncStatus is missing (e.g., old record without status field)
                    if not existing.get("syncStatus"):
                        doc_ref.set({"syncStatus": "pending", "validationStatus": "pending"}, merge=True)
                        initialized += 1
                    else:
                        skipped += 1
            except Exception as err:
                print(f"[Firestore Init] Error for {student_doc_id}: {err}")

        print(f"[Firestore Init] Completed: {initialized} pending records initialized, {skipped} already had status.")
    except Exception as err:
        print(f"[Firestore Init] Error: {err}")
    finally:
        db.close()
