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

            total_solved = stats.total_solved if stats else 0
            total_solved_sum += total_solved
            weekly_prog = prog.weekly_progress if prog else 0
            weekly_progress_sum += weekly_prog

            if total_solved > 0:
                active_count += 1

            status = stats.status if stats else "NOT STARTED"
            if status == "OK":
                valid_profiles += 1
            elif status == "MISSING LINK":
                missing_links += 1
            elif status == "INVALID LINK":
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
            dept_summary[dept_code]["total_solved"] += total_solved
            dept_summary[dept_code]["weekly_progress"] += weekly_prog
            if total_solved > 0:
                dept_summary[dept_code]["active_students"] += 1
            if total_solved > dept_summary[dept_code]["top_solved"]:
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

            # LeetCode Stats Document payload
            stats_doc = {
                "studentId": s.id,
                "registerNo": s.reg_no,
                "leetcodeUsername": s.username or "",
                "totalSolved": total_solved,
                "easySolved": stats.easy_solved if stats else 0,
                "mediumSolved": stats.medium_solved if stats else 0,
                "hardSolved": stats.hard_solved if stats else 0,
                "contestRating": stats.contest_rating if stats else None,
                "globalRanking": stats.contest_global_ranking if stats else None,
                "status": status,
                "weeklySolved": weekly_prog,
                "streakCount": prog.streak_count if prog else 0,
                "consistencyScore": prog.consistency_score if prog else 0.0,
                "collegeRank": prog.college_rank if prog else None
            }

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
                print("Cloud Firestore pre-calculated aggregations successfully updated!")
            except Exception as ex:
                print(f"Error syncing Cloud Firestore aggregations: {ex}")

        print(f"Successfully processed & verified {synced_count} student statistics records and pre-calculated aggregations.")
    finally:
        db.close()

if __name__ == "__main__":
    sync_database_to_firestore()
