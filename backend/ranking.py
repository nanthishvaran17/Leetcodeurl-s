from typing import List, Dict, Any
from sqlalchemy.orm import Session
from backend.models import Student, LeetCodeProfileStats, WeeklyStudentProgress, WeeklySessionSnapshot
from backend.logger import logger

def calculate_competition_ranks(scores: List[float]) -> List[int]:
    """
    Computes competition ranks for a list of scores (higher is better).
    Tie handling: 500 -> 1, 450 -> 2, 450 -> 2, 300 -> 4
    """
    if not scores:
        return []
        
    sorted_unique = sorted(list(set(scores)), reverse=True)
    rank_map = {}
    
    current_rank = 1
    for val in sorted_unique:
        rank_map[val] = current_rank
        # Count how many items had this value
        count = scores.count(val)
        current_rank += count

    return [rank_map[val] for val in scores]

def update_all_rankings_and_badges(db: Session, week_number: int = 1, academic_year: str = "2026-27"):
    """
    Recalculates College, Department, Year, Section, and Progress Ranks for all active students.
    Also computes streaks, consistency scores, and milestone badges.
    """
    logger.info(f"Recalculating multi-level rankings for week {week_number} ({academic_year})...")

    # Fetch all active students with their latest stats
    students = db.query(Student).filter(Student.is_active == True).all()
    if not students:
        logger.info("No active students found for ranking.")
        return

    # Gather data dict per student
    student_records = []
    for s in students:
        total_solved = s.stats.total_solved if s.stats else 0
        easy = s.stats.easy_solved if s.stats else 0
        med = s.stats.medium_solved if s.stats else 0
        hard = s.stats.hard_solved if s.stats else 0
        rating = s.stats.contest_rating if s.stats else None

        # Fetch latest weekly snapshot for this week
        snap = db.query(WeeklySessionSnapshot).filter(
            WeeklySessionSnapshot.student_id == s.id
        ).order_by(WeeklySessionSnapshot.id.desc()).first()

        weekly_progress = snap.problems_added if snap else 0

        # Calculate historical streaks and consistency
        snapshots = db.query(WeeklySessionSnapshot).filter(
            WeeklySessionSnapshot.student_id == s.id
        ).order_by(WeeklySessionSnapshot.id.desc()).all()

        total_sessions = len(snapshots)
        active_sessions = sum(1 for sn in snapshots if sn.status == "STARTED")
        consistency = round((active_sessions / total_sessions * 100), 1) if total_sessions > 0 else 0.0

        # Streak calculation
        current_streak = 0
        for sn in snapshots:
            if sn.status == "STARTED":
                current_streak += 1
            else:
                break

        student_records.append({
            "student_id": s.id,
            "dept_id": s.department_id,
            "year_level": s.year_level,
            "section_id": s.section_id,
            "total_solved": total_solved,
            "weekly_progress": weekly_progress,
            "easy": easy,
            "med": med,
            "hard": hard,
            "rating": rating,
            "streak": current_streak,
            "consistency": consistency
        })

    # 1. Calculate College Ranks
    total_solved_scores = [r["total_solved"] for r in student_records]
    college_ranks = calculate_competition_ranks(total_solved_scores)
    for idx, r in enumerate(student_records):
        r["college_rank"] = college_ranks[idx]

    # 2. Calculate Progress Ranks
    progress_scores = [r["weekly_progress"] for r in student_records]
    progress_ranks = calculate_competition_ranks(progress_scores)
    for idx, r in enumerate(student_records):
        r["progress_rank"] = progress_ranks[idx]

    # 3. Calculate Department Ranks
    dept_groups: Dict[int, List[int]] = {}
    for idx, r in enumerate(student_records):
        dept_groups.setdefault(r["dept_id"], []).append(idx)

    for dept_id, indices in dept_groups.items():
        scores = [student_records[i]["total_solved"] for i in indices]
        ranks = calculate_competition_ranks(scores)
        for i, rank_val in zip(indices, ranks):
            student_records[i]["dept_rank"] = rank_val

    # 4. Calculate Year Ranks
    year_groups: Dict[str, List[int]] = {}
    for idx, r in enumerate(student_records):
        year_groups.setdefault(r["year_level"], []).append(idx)

    for year_lvl, indices in year_groups.items():
        scores = [student_records[i]["total_solved"] for i in indices]
        ranks = calculate_competition_ranks(scores)
        for i, rank_val in zip(indices, ranks):
            student_records[i]["year_rank"] = rank_val

    # 5. Calculate Section Ranks
    sec_groups: Dict[Optional[int], List[int]] = {}
    for idx, r in enumerate(student_records):
        sec_groups.setdefault(r["section_id"], []).append(idx)

    for sec_id, indices in sec_groups.items():
        scores = [student_records[i]["total_solved"] for i in indices]
        ranks = calculate_competition_ranks(scores)
        for i, rank_val in zip(indices, ranks):
            student_records[i]["section_rank"] = rank_val

    # 6. Save WeeklyStudentProgress and Assign Badges
    for r in student_records:
        badges = []
        if r["college_rank"] == 1:
            badges.append("🏆 College #1")
        elif r["dept_rank"] == 1:
            badges.append("🏅 Dept #1")
        elif r["section_rank"] == 1:
            badges.append("🥇 Section #1")

        if r["progress_rank"] <= 3 and r["weekly_progress"] > 0:
            badges.append("🚀 Fastest Improver")

        if r["streak"] >= 10:
            badges.append("🔥 10 Week Streak")
        elif r["streak"] >= 5:
            badges.append("🔥 5 Week Streak")

        if r["total_solved"] >= 500:
            badges.append("⚡ 500 Solved")
        elif r["total_solved"] >= 200:
            badges.append("💯 200 Solved")
        elif r["total_solved"] >= 100:
            badges.append("🎯 100 Solved")

        if r["consistency"] >= 90:
            badges.append("🌟 90% Consistency")

        if r["rating"] and r["rating"] >= 1600:
            badges.append("👑 Contest Champion")

        # Composite Coding Score (Difficulty-weighted: Easy*1 + Med*3 + Hard*5 + Progress*2)
        composite_score = (r["easy"] * 1.0) + (r["med"] * 3.0) + (r["hard"] * 5.0) + (r["weekly_progress"] * 2.0)

        # Update or create progress record
        prog_rec = db.query(WeeklyStudentProgress).filter(
            WeeklyStudentProgress.student_id == r["student_id"],
            WeeklyStudentProgress.week_number == week_number,
            WeeklyStudentProgress.academic_year == academic_year
        ).first()

        if not prog_rec:
            prog_rec = WeeklyStudentProgress(
                student_id=r["student_id"],
                week_number=week_number,
                academic_year=academic_year
            )
            db.add(prog_rec)

        prog_rec.total_solved = r["total_solved"]
        prog_rec.weekly_progress = r["weekly_progress"]
        prog_rec.easy_solved = r["easy"]
        prog_rec.medium_solved = r["med"]
        prog_rec.hard_solved = r["hard"]
        prog_rec.rating = r["rating"]
        prog_rec.college_rank = r["college_rank"]
        prog_rec.dept_rank = r["dept_rank"]
        prog_rec.year_rank = r["year_rank"]
        prog_rec.section_rank = r["section_rank"]
        prog_rec.progress_rank = r["progress_rank"]
        prog_rec.streak_count = r["streak"]
        prog_rec.consistency_score = r["consistency"]
        prog_rec.badge_list = badges
        prog_rec.composite_score = composite_score

    db.commit()
    logger.info("Multi-level rankings and badges successfully updated!")
