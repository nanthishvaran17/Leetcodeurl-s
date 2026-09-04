from typing import List, Dict, Any
from sqlalchemy.orm import Session
from backend.models import Section, Student, WeeklyStudentProgress

def calculate_section_battles(db: Session) -> List[Dict[str, Any]]:
    """
    Computes weekly Section vs Section leaderboard battle scores.
    Formula: Average problems solved + (Active Percentage * 2)
    """
    sections = db.query(Section).all()
    battle_results = []

    for sec in sections:
        students = db.query(Student).filter(Student.section_id == sec.id, Student.is_active == True).all()
        total_students = len(students)
        if total_students == 0:
            continue

        active_count = 0
        total_weekly_problems = 0

        for s in students:
            prog = db.query(WeeklyStudentProgress).filter(WeeklyStudentProgress.student_id == s.id).order_by(WeeklyStudentProgress.id.desc()).first()
            if prog:
                if prog.weekly_progress > 0:
                    active_count += 1
                total_weekly_problems += prog.weekly_progress

        avg_solved = round(total_weekly_problems / total_students, 2)
        participation_rate = round((active_count / total_students * 100), 1)
        battle_score = round(avg_solved * 10 + participation_rate, 1)

        battle_results.append({
            "section_id": sec.id,
            "section_name": sec.name,
            "department_code": sec.department.code if sec.department else "GEN",
            "year_level": sec.year_level,
            "total_students": total_students,
            "active_students": active_count,
            "participation_rate": participation_rate,
            "avg_weekly_solved": avg_solved,
            "battle_score": battle_score
        })

    # Sort sections by battle score
    battle_results.sort(key=lambda x: x["battle_score"], reverse=True)
    for rank, res in enumerate(battle_results, 1):
        res["battle_rank"] = rank

    return battle_results
