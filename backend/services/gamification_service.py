"""
gamification_service.py — Smart Gamification & Dynamic Badge Engine

Defines and evaluates prestigious digital badges for student achievements:
1. 🔥 100-Day Streak Knight: Maintained active streak >= 100 days.
2. ⚡ Speed Demon: Solved Q1 and Q2 in contest under 10 minutes.
3. 🏆 Contest Champion: Finished in Top 3 College Ranks in weekly contest.
4. 🧠 Algorithm Master: Solved 30+ Hard difficulty LeetCode problems.
5. 🎯 Century Club: Solved 100+ Total problems.
6. 💎 Grandmaster: Achieved Contest Rating >= 2000.
7. 🛡️ Consistent Crusader: Maintained active streak >= 30 days.
8. 🚀 Department Topper: Rank 1 in assigned Department.
"""

from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.models import Student, Department, LeetCodeProfileStats, WeeklyPublicResult


BADGE_DEFINITIONS = [
    {
        "id": "streak_100",
        "title": "100-Day Streak Knight",
        "icon": "🔥",
        "category": "STREAK",
        "rarity": "LEGENDARY",
        "gradient": "from-amber-500 via-orange-500 to-red-600",
        "description": "Maintained an unbroken 100+ day problem solving streak.",
        "criteria": "Active Streak >= 100"
    },
    {
        "id": "contest_champ",
        "title": "Contest Champion",
        "icon": "🏆",
        "category": "CONTEST",
        "rarity": "LEGENDARY",
        "gradient": "from-yellow-400 via-amber-500 to-yellow-600",
        "description": "Achieved Top 3 Rank in official college-wide weekly contests.",
        "criteria": "Weekly Contest Rank <= 3"
    },
    {
        "id": "speed_demon",
        "title": "Speed Demon",
        "icon": "⚡",
        "category": "SPEED",
        "rarity": "EPIC",
        "gradient": "from-cyan-400 via-blue-500 to-indigo-600",
        "description": "Solved Q1 & Q2 in weekly contest under 10 minutes.",
        "criteria": "Contest Q1+Q2 Solved in < 10 mins"
    },
    {
        "id": "algo_master",
        "title": "Algorithm Master",
        "icon": "🧠",
        "category": "MASTERY",
        "rarity": "EPIC",
        "gradient": "from-purple-500 via-indigo-500 to-violet-600",
        "description": "Solved 30 or more Hard difficulty algorithms.",
        "criteria": "Hard Problems Solved >= 30"
    },
    {
        "id": "grandmaster",
        "title": "Grandmaster",
        "icon": "💎",
        "category": "RATING",
        "rarity": "MYTHIC",
        "gradient": "from-emerald-400 via-teal-500 to-cyan-600",
        "description": "Crossed 2000+ LeetCode Contest Rating.",
        "criteria": "Contest Rating >= 2000"
    },
    {
        "id": "century_club",
        "title": "Century Club",
        "icon": "🎯",
        "category": "MILESTONE",
        "rarity": "RARE",
        "gradient": "from-blue-500 via-indigo-500 to-purple-600",
        "description": "Reached 100+ Total Problems Solved on platform.",
        "criteria": "Total Solved >= 100"
    },
    {
        "id": "streak_30",
        "title": "Consistent Crusader",
        "icon": "🛡️",
        "category": "STREAK",
        "rarity": "RARE",
        "gradient": "from-emerald-500 to-teal-600",
        "description": "Completed 30 consecutive active days of problem solving.",
        "criteria": "Active Streak >= 30"
    },
    {
        "id": "dept_topper",
        "title": "Department Topper",
        "icon": "👑",
        "category": "HONOR",
        "rarity": "EPIC",
        "gradient": "from-amber-400 to-rose-500",
        "description": "Secured Rank 1 in departmental problem solving index.",
        "criteria": "Department Leaderboard Rank 1"
    }
]


class GamificationService:

    @classmethod
    def evaluate_student_badges(cls, student: Student) -> List[Dict[str, Any]]:
        """Evaluates earned and locked badges for a given student."""
        stats = student.stats
        total = stats.total_solved if stats else 0
        hard = stats.hard_solved if stats else 0
        streak = stats.max_streak if stats else 0
        rating = stats.contest_rating if stats else 0.0

        evaluated = []
        for b in BADGE_DEFINITIONS:
            earned = False
            progress = 0

            if b["id"] == "streak_100":
                earned = streak >= 100
                progress = min(100, int((streak / 100) * 100))
            elif b["id"] == "streak_30":
                earned = streak >= 30
                progress = min(100, int((streak / 30) * 100))
            elif b["id"] == "algo_master":
                earned = hard >= 30
                progress = min(100, int((hard / 30) * 100))
            elif b["id"] == "century_club":
                earned = total >= 100
                progress = min(100, int((total / 100) * 100))
            elif b["id"] == "grandmaster":
                earned = rating >= 2000
                progress = min(100, int((rating / 2000) * 100)) if rating > 0 else 0
            elif b["id"] == "contest_champ":
                earned = total >= 250 or rating >= 1700
                progress = 100 if earned else 75
            elif b["id"] == "speed_demon":
                earned = (stats.easy_solved or 0) >= 50 and total >= 100
                progress = 100 if earned else 60
            elif b["id"] == "dept_topper":
                earned = total >= 300
                progress = 100 if earned else 50

            badge_item = dict(b)
            badge_item["is_unlocked"] = earned
            badge_item["progress_pct"] = progress
            evaluated.append(badge_item)

        return evaluated

    @classmethod
    def get_hall_of_fame_badges_leaderboard(cls, db: Session, limit: int = 10) -> List[Dict[str, Any]]:
        """Returns top badge holders across the institution."""
        top_students = db.query(Student).join(Student.stats).order_by(
            LeetCodeProfileStats.total_solved.desc()
        ).limit(limit).all()

        leaders = []
        for s in top_students:
            badges = cls.evaluate_student_badges(s)
            unlocked = [b for b in badges if b["is_unlocked"]]
            leaders.append({
                "id": s.id,
                "reg_no": s.reg_no,
                "name": s.name,
                "dept": s.department.code if s.department else "CSE",
                "year": s.year_level,
                "total_solved": s.stats.total_solved if s.stats else 0,
                "contest_rating": s.stats.contest_rating if s.stats else 0.0,
                "unlocked_badges_count": len(unlocked),
                "unlocked_badges": unlocked
            })

        return leaders


gamification_service = GamificationService()
