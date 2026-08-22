"""
seed_demo_data.py — Interactive Demo / Sandbox 3,500 Student Scale Generator
Generates realistic institutional dataset across 12 departments for management live demonstration.
"""

import os
import sys
import random
import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.database import SessionLocal
from backend.models import (
    Student, Department, Section, LeetCodeProfileStats,
    WeeklySession, WeeklyPublicResult, WeeklyVirtualResult
)
from backend.ranking import update_all_rankings_and_badges
from backend.scripts.import_fresh_students_dataset import generate_canonical_roster
from backend.cache import cache
from backend.logger import logger


DEPARTMENTS_CONFIG = [
    ("CSE", "Computer Science and Engineering", 450),
    ("CSE(CS)", "Computer Science and Engineering (Cyber Security)", 300),
    ("CSE(IOT)", "Computer Science and Engineering (IoT)", 280),
    ("IT", "Information Technology", 400),
    ("AIDS", "Artificial Intelligence and Data Science", 420),
    ("AIML", "Artificial Intelligence and Machine Learning", 350),
    ("ECE", "Electronics and Communication Engineering", 380),
    ("EEE", "Electrical and Electronics Engineering", 300),
    ("MECH", "Mechanical Engineering", 220),
    ("CIVIL", "Civil Engineering", 180),
    ("BME", "Biomedical Engineering", 120),
    ("AGRI", "Agricultural Engineering", 100),
]

FIRST_NAMES = ["Aravind", "Bharath", "Deepak", "Janani", "Kiruthika", "Magudapathi", "Naveen", "Poomitha", "Sakthi", "Sharmila", "Sowmiya", "Vignesh", "Anitha", "Dharani", "Gokul", "Harish", "Karthik", "Lavanya", "Manikandan", "Nithya", "Praveen", "Ramesh", "Sangeetha", "Tharun", "Yuvan"]
LAST_NAMES = ["S", "K", "M", "P", "R", "T", "V", "A", "C", "G", "N", "B"]


def seed_demo_students(target_count: int = 3500) -> int:
    db = SessionLocal()
    try:
        logger.info(f"[DEMO_SEED] Starting generation of {target_count} demonstration student records...")
        
        # Ensure all 12 departments exist
        dept_map = {}
        for code, name, _ in DEPARTMENTS_CONFIG:
            d = db.query(Department).filter(Department.code == code).first()
            if not d:
                d = Department(name=name, code=code)
                db.add(d)
                db.commit()
                db.refresh(d)
            dept_map[code] = d.id

        created_count = 0
        students_to_add = []
        stats_to_add = []

        for code, name, count in DEPARTMENTS_CONFIG:
            for idx in range(1, count + 1):
                year_num = random.choice([2, 3, 4])
                year_level = "II" if year_num == 2 else ("III" if year_num == 3 else "IV")
                year_prefix = "25" if year_num == 2 else ("24" if year_num == 3 else "23")
                reg_no = f"7322{year_prefix}{code[:2]}{idx:03d}"

                st_exists = db.query(Student).filter(Student.reg_no == reg_no).first()
                if st_exists:
                    continue

                fn = random.choice(FIRST_NAMES)
                ln = random.choice(LAST_NAMES)
                full_name = f"{fn.upper()} {ln}"
                username = f"{fn.lower()}_{idx}"

                st = Student(
                    reg_no=reg_no,
                    name=full_name,
                    username=username,
                    leetcode_url=f"https://leetcode.com/u/{username}/",
                    department_id=dept_map[code],
                    year_level=year_level,
                    is_active=True
                )
                db.add(st)
                created_count += 1

        db.commit()
        logger.info(f"[DEMO_SEED] Created {created_count} students. Updating multi-level rankings...")
        update_all_rankings_and_badges(db)
        generate_canonical_roster(db)
        cache.clear()
        logger.info(f"[DEMO_SEED_COMPLETE] Institutional demo seed complete: {created_count} students ready.")
        return created_count
    finally:
        db.close()


if __name__ == "__main__":
    count_arg = int(sys.argv[1]) if len(sys.argv) > 1 else 3500
    res = seed_demo_students(target_count=count_arg)
    print(f"Generated {res} demonstration students.")
