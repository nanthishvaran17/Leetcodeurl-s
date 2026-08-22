"""
update_academic_year_mapping.py — Updates student year_level based on user's exact specification:
- 23 start (e.g. 732223..., 23CC...) -> IV Year (Final Year)
- 24 start (e.g. 732224..., 24CC...) -> III Year (3rd Year)
- 25 start (e.g. 732225..., 25CC...) -> II Year (2nd Year)
- 26 start (e.g. 732226..., 26CC...) -> I Year (1st Year)
"""

import os
import sys
import re
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.database import SessionLocal
from backend.models import Student
from backend.scripts.import_fresh_students_dataset import generate_canonical_roster
from backend.cache import cache


def update_year_levels():
    db = SessionLocal()
    students = db.query(Student).all()
    print(f"Updating year levels for {len(students)} students...")

    counts = {"I": 0, "II": 0, "III": 0, "IV": 0}

    for st in students:
        reg = st.reg_no.upper()
        # Look for 23, 24, 25, 26 in the register number
        if "732223" in reg or "23CC" in reg or "23CI" in reg or "23CS" in reg or "23IT" in reg or "23AI" in reg or "23EC" in reg or "23EE" in reg or "23ME" in reg or "23AG" in reg:
            year = "IV"
        elif "732224" in reg or "24CC" in reg or "24CI" in reg or "24CS" in reg or "24IT" in reg or "24AI" in reg or "24EC" in reg or "24EE" in reg or "24ME" in reg or "24AG" in reg:
            year = "III"
        elif "732225" in reg or "73225" in reg or "25CC" in reg or "25CI" in reg or "25CS" in reg or "25IT" in reg or "25AI" in reg or "25EC" in reg or "25EE" in reg or "25ME" in reg or "25AG" in reg:
            year = "II"
        elif "732226" in reg or "26CC" in reg or "26CI" in reg or "26CS" in reg or "26IT" in reg or "26AI" in reg or "26EC" in reg or "26EE" in reg or "26ME" in reg or "26AG" in reg:
            year = "I"
        else:
            # Fallback regex extraction of 2-digit admission year after 7322 or 73222
            m = re.search(r'(?:73222|7322|)(\d{2})', reg)
            if m:
                prefix = m.group(1)
                if prefix == "23":
                    year = "IV"
                elif prefix == "24":
                    year = "III"
                elif prefix == "25":
                    year = "II"
                elif prefix == "26":
                    year = "I"
                else:
                    year = "II"
            else:
                year = "II"

        st.year_level = year
        counts[year] = counts.get(year, 0) + 1

    db.commit()
    cache.clear()
    print(f"Updated year levels successfully:")
    for yr, cnt in sorted(counts.items()):
        print(f"  {yr} Year: {cnt} students")

    generate_canonical_roster(db)
    db.close()


if __name__ == "__main__":
    update_year_levels()
