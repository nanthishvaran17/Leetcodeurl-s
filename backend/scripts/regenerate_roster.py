"""
Regenerates canonicalRoster.ts from live DB data.
Run: python -m backend.scripts.regenerate_roster
"""
import json
import os
from backend.database import SessionLocal
from backend.models import Student, LeetCodeProfileStats, WeeklyStudentProgress
from sqlalchemy.orm import joinedload


def regenerate():
    db = SessionLocal()
    try:
        students = (
            db.query(Student)
            .options(
                joinedload(Student.stats),
                joinedload(Student.department),
                joinedload(Student.section),
            )
            .filter(Student.is_active == True)
            .order_by(Student.name.asc())
            .all()
        )

        # Build a progress map for college_rank / dept_rank
        progs = (
            db.query(WeeklyStudentProgress)
            .order_by(WeeklyStudentProgress.id.desc())
            .all()
        )
        prog_map = {}
        for p in progs:
            if p.student_id not in prog_map:
                prog_map[p.student_id] = p

        roster = []
        for s in students:
            st = s.stats
            is_verified = (
                st is not None
                and st.sync_status in ("success", "stale", "verified")
                and st.total_solved is not None
            )
            roster.append(
                {
                    "id": s.id,
                    "name": s.name,
                    "reg_no": s.reg_no,
                    "username": s.username,
                    "year_level": s.year_level,
                    "department_id": s.department_id,
                    "department": (
                        {
                            "id": s.department.id,
                            "name": s.department.name,
                            "code": s.department.code,
                        }
                        if s.department
                        else None
                    ),
                    "section": (
                        {"id": s.section.id, "name": s.section.name}
                        if s.section
                        else None
                    ),
                    "college_rank": prog_map[s.id].college_rank if s.id in prog_map else None,
                    "dept_rank": prog_map[s.id].dept_rank if s.id in prog_map else None,
                    "stats": (
                        {
                            "total_solved": st.total_solved if is_verified else None,
                            "easy_solved": st.easy_solved if is_verified else None,
                            "medium_solved": st.medium_solved if is_verified else None,
                            "hard_solved": st.hard_solved if is_verified else None,
                            "contest_rating": st.contest_rating if is_verified else None,
                            "contest_global_ranking": (
                                st.contest_global_ranking if is_verified else None
                            ),
                            "public_profile_ranking": (
                                st.public_profile_ranking if is_verified else None
                            ),
                            "sync_status": st.sync_status,
                            "status": st.status,
                            "last_verified_at": (
                                st.last_verified_at.isoformat()
                                if st.last_verified_at
                                else None
                            ),
                        }
                        if st
                        else None
                    ),
                }
            )

        total = len(roster)
        verified = sum(1 for r in roster if r.get("stats") and r["stats"].get("total_solved") is not None)
        print(f"Total students: {total} | Verified with stats: {verified}")

        ts_content = (
            "// Auto-generated canonical roster — do not edit manually\n"
            "// Run: python -m backend.scripts.regenerate_roster\n"
            "export const CANONICAL_ROSTER: any[] = "
            + json.dumps(roster, indent=2, default=str)
            + ";\n\nexport const CANONICAL_SUMMARY = "
            + json.dumps({"total_students": total, "verified_profiles": verified}, indent=2)
            + ";\n"
        )

        out_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
            "frontend", "src", "data", "canonicalRoster.ts",
        )
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(ts_content)

        print(f"Written: {out_path}")
    finally:
        db.close()


if __name__ == "__main__":
    regenerate()
