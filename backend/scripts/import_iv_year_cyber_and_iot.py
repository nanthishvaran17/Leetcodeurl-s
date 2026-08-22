"""
import_iv_year_cyber_and_iot.py — Imports/Updates IV Year CSE(CS) and CSE(IOT) Student Roster.
"""

import os
import sys
sys.path.insert(0, os.getcwd())
import re
from sqlalchemy.orm import Session

from backend.database import SessionLocal
from backend.models import Student, Department, LeetCodeProfileStats, LeetCodeProfile, LeetCodeProblemStats

IV_YEAR_DATA = [
    # CSE(CS) — 28 Students
    {"sno": 1, "reg_no": "732223CC001", "short_reg": "23CC001", "name": "AATHAVAN T", "dept": "CSE(CS)", "url": "https://leetcode.com/u/AathavanThiyakeswaran/"},
    {"sno": 2, "reg_no": "732223CC002", "short_reg": "23CC002", "name": "S.ABIRAMI", "dept": "CSE(CS)", "url": "https://leetcode.com/u/SlrLj6CNJL/"},
    {"sno": 3, "reg_no": "732223CC003", "short_reg": "23CC003", "name": "ASWIN P", "dept": "CSE(CS)", "url": "https://leetcode.com/u/aswinkasin/"},
    {"sno": 4, "reg_no": "732223CC005", "short_reg": "23CC005", "name": "BHARATH I", "dept": "CSE(CS)", "url": "https://leetcode.com/u/Bharath_77/"},
    {"sno": 5, "reg_no": "732223CC007", "short_reg": "23CC007", "name": "DEEPADHARSHINI C", "dept": "CSE(CS)", "url": "https://leetcode.com/u/deepadharshini_10/"},
    {"sno": 6, "reg_no": "732223CC009", "short_reg": "23CC009", "name": "DEEPAKKUMAR E", "dept": "CSE(CS)", "url": "https://leetcode.com/u/Deepak1524/"},
    {"sno": 7, "reg_no": "732223CC010", "short_reg": "23CC010", "name": "DEEPAKKUMAR M", "dept": "CSE(CS)", "url": "https://leetcode.com/u/Deepak2612/"},
    {"sno": 8, "reg_no": "732223CC013", "short_reg": "23CC013", "name": "ENIYAVAN R", "dept": "CSE(CS)", "url": "https://leetcode.com/u/Eniyavan_r/"},
    {"sno": 9, "reg_no": "732223CC017", "short_reg": "23CC017", "name": "JANARANSHINI P", "dept": "CSE(CS)", "url": "https://leetcode.com/u/Janaranshini_17/"},
    {"sno": 10, "reg_no": "732223CC020", "short_reg": "23CC020", "name": "KANISHAA.K.S", "dept": "CSE(CS)", "url": "https://leetcode.com/u/kani_shan/"},
    {"sno": 11, "reg_no": "732223CC021", "short_reg": "23CC021", "name": "KANISKA N J", "dept": "CSE(CS)", "url": "https://leetcode.com/u/ka_nizzu29/"},
    {"sno": 12, "reg_no": "732223CC023", "short_reg": "23CC023", "name": "KAVINRAJAN K", "dept": "CSE(CS)", "url": "https://leetcode.com/u/kavinrajan/"},
    {"sno": 13, "reg_no": "732223CC025", "short_reg": "23CC025", "name": "KEERTHANA B", "dept": "CSE(CS)", "url": "https://leetcode.com/u/Keerthu-2005/"},
    {"sno": 14, "reg_no": "732223CC031", "short_reg": "23CC031", "name": "MOWNAVARTHINI A L", "dept": "CSE(CS)", "url": "https://leetcode.com/u/mowna_14/"},
    {"sno": 15, "reg_no": "732223CC038", "short_reg": "23CC038", "name": "PRAVEEN KUMAR J", "dept": "CSE(CS)", "url": "https://leetcode.com/u/PRAVEEN360/"},
    {"sno": 16, "reg_no": "732223CC039", "short_reg": "23CC039", "name": "PRAVEEN VENKATESH A V", "dept": "CSE(CS)", "url": "https://leetcode.com/u/pravexn/"},
    {"sno": 17, "reg_no": "732223CC042", "short_reg": "23CC042", "name": "PRIYADHARSHINI K", "dept": "CSE(CS)", "url": "https://leetcode.com/u/dhars_02/"},
    {"sno": 18, "reg_no": "732223CC043", "short_reg": "23CC043", "name": "RAGAVAN S", "dept": "CSE(CS)", "url": "https://leetcode.com/u/j123kcmcn/"},
    {"sno": 19, "reg_no": "732223CC044", "short_reg": "23CC044", "name": "RAM PRAKASH S", "dept": "CSE(CS)", "url": "https://leetcode.com/u/Raamprakash5/"},
    {"sno": 20, "reg_no": "732223CC045", "short_reg": "23CC045", "name": "RATHEESH S", "dept": "CSE(CS)", "url": "https://leetcode.com/u/ratheesh1226/"},
    {"sno": 21, "reg_no": "732223CC046", "short_reg": "23CC046", "name": "RITHIKA P", "dept": "CSE(CS)", "url": "https://leetcode.com/u/rithikapi13/"},
    {"sno": 22, "reg_no": "732223CC047", "short_reg": "23CC047", "name": "SARAVANAN R", "dept": "CSE(CS)", "url": "https://leetcode.com/u/SARAVANAN_ROLEX/"},
    {"sno": 23, "reg_no": "732223CC050", "short_reg": "23CC050", "name": "SRIVIDHYA S", "dept": "CSE(CS)", "url": "https://leetcode.com/u/SRIVIDHYA_25/"},
    {"sno": 24, "reg_no": "732223CC051", "short_reg": "23CC051", "name": "SRIRAM.S", "dept": "CSE(CS)", "url": "https://leetcode.com/u/Sriram6758/"},
    {"sno": 25, "reg_no": "732223CC052", "short_reg": "23CC052", "name": "STEFFY MARTINA P", "dept": "CSE(CS)", "url": "https://leetcode.com/u/Steffy_15/"},
    {"sno": 26, "reg_no": "732223CC053", "short_reg": "23CC053", "name": "SUBITHA P S", "dept": "CSE(CS)", "url": "https://leetcode.com/u/23cc053/"},
    {"sno": 27, "reg_no": "732223CC056", "short_reg": "23CC056", "name": "VIGNESH J", "dept": "CSE(CS)", "url": "https://leetcode.com/u/Vignesh_2639/"},
    {"sno": 28, "reg_no": "732223CC059", "short_reg": "23CC059", "name": "WASIM M", "dept": "CSE(CS)", "url": "https://leetcode.com/u/Wasim_M/"},

    # CSE(IOT) — 27 Students
    {"sno": 1, "reg_no": "732223CI002", "short_reg": "23CI002", "name": "AJAY VISHALESWAR", "dept": "CSE(IOT)", "url": "https://leetcode.com/u/ajaysoftware/"},
    {"sno": 2, "reg_no": "732223CI004", "short_reg": "23CI004", "name": "BHUVANADHARSHINI C", "dept": "CSE(IOT)", "url": "https://leetcode.com/u/Bhuvanadharshini/"},
    {"sno": 3, "reg_no": "732223CI006", "short_reg": "23CI006", "name": "DHARNEESH P", "dept": "CSE(IOT)", "url": "https://leetcode.com/u/TDq3huRfEI/"},
    {"sno": 4, "reg_no": "732223CI007", "short_reg": "23CI007", "name": "DIVYA A", "dept": "CSE(IOT)", "url": "https://leetcode.com/u/DIVI_ARUL/"},
    {"sno": 5, "reg_no": "732223CI010", "short_reg": "23CI010", "name": "GOKILA.G", "dept": "CSE(IOT)", "url": ""},
    {"sno": 6, "reg_no": "732223CI012", "short_reg": "23CI012", "name": "GOWCIKA U", "dept": "CSE(IOT)", "url": "https://leetcode.com/u/Gowcika/"},
    {"sno": 7, "reg_no": "732223CI013", "short_reg": "23CI013", "name": "HAMSHA N", "dept": "CSE(IOT)", "url": "https://leetcode.com/u/hamsha07/"},
    {"sno": 8, "reg_no": "732223CI014", "short_reg": "23CI014", "name": "HAREE D", "dept": "CSE(IOT)", "url": "https://leetcode.com/u/Haree05/"},
    {"sno": 9, "reg_no": "732223CI015", "short_reg": "23CI015", "name": "HARINI S", "dept": "CSE(IOT)", "url": ""},
    {"sno": 10, "reg_no": "732223CI018", "short_reg": "23CI018", "name": "JAYASURYA P", "dept": "CSE(IOT)", "url": "https://leetcode.com/u/Jayasurya-619/"},
    {"sno": 11, "reg_no": "732223CI021", "short_reg": "23CI021", "name": "KAMALA VISHNU G", "dept": "CSE(IOT)", "url": ""},
    {"sno": 12, "reg_no": "732223CI022", "short_reg": "23CI022", "name": "KARMUKILAN A", "dept": "CSE(IOT)", "url": "https://leetcode.com/u/pPPRNale4T/"},
    {"sno": 13, "reg_no": "732223CI023", "short_reg": "23CI023", "name": "KARTHIK.V", "dept": "CSE(IOT)", "url": "https://leetcode.com/u/karthik_v3/"},
    {"sno": 14, "reg_no": "732223CI025", "short_reg": "23CI025", "name": "KARUNYA C", "dept": "CSE(IOT)", "url": "https://leetcode.com/u/sivakarunya/"},
    {"sno": 15, "reg_no": "732223CI027", "short_reg": "23CI027", "name": "KAVI ISHWARRYA S K", "dept": "CSE(IOT)", "url": "https://leetcode.com/u/s9hXtuAA2E/"},
    {"sno": 16, "reg_no": "732223CI028", "short_reg": "23CI028", "name": "KAVIN V", "dept": "CSE(IOT)", "url": ""},
    {"sno": 17, "reg_no": "732223CI029", "short_reg": "23CI029", "name": "KAVIYARASU S", "dept": "CSE(IOT)", "url": "https://leetcode.com/u/KAVIYARASU_S123/"},
    {"sno": 18, "reg_no": "732223CI030", "short_reg": "23CI030", "name": "KEERTHANA K", "dept": "CSE(IOT)", "url": "https://leetcode.com/u/K_KEERTHANA_/"},
    {"sno": 19, "reg_no": "732223CI034", "short_reg": "23CI034", "name": "MOHAMED AQDHAS U", "dept": "CSE(IOT)", "url": "https://leetcode.com/u/AQDHAS/"},
    {"sno": 20, "reg_no": "732223CI038", "short_reg": "23CI038", "name": "PRABHAKARAN . S", "dept": "CSE(IOT)", "url": "https://leetcode.com/u/Prabha_1503/"},
    {"sno": 21, "reg_no": "732223CI044", "short_reg": "23CI044", "name": "RAVI BHARATHI.J", "dept": "CSE(IOT)", "url": "https://leetcode.com/u/ravi_bharathi509/"},
    {"sno": 22, "reg_no": "732223CI046", "short_reg": "23CI046", "name": "ROHITH T", "dept": "CSE(IOT)", "url": ""},
    {"sno": 23, "reg_no": "732223CI050", "short_reg": "23CI050", "name": "SATHISHKUMAR.S", "dept": "CSE(IOT)", "url": ""},
    {"sno": 24, "reg_no": "732223CI053", "short_reg": "23CI053", "name": "SUJITH K", "dept": "CSE(IOT)", "url": "https://leetcode.com/u/sujith2006/"},
    {"sno": 25, "reg_no": "732223CI055", "short_reg": "23CI055", "name": "G THEJASWINI", "dept": "CSE(IOT)", "url": "https://leetcode.com/u/thejaswini_10/"},
    {"sno": 26, "reg_no": "732223CI058", "short_reg": "23CI058", "name": "VICHITHRA.V", "dept": "CSE(IOT)", "url": "https://leetcode.com/u/VichithraVelusamy/"},
    {"sno": 27, "reg_no": "732223CI001", "short_reg": "23CI001", "name": "AAKASH SHIVA KB", "dept": "CSE(IOT)", "url": "https://leetcode.com/u/aakashshiva/"},
]


def extract_username(url: str) -> str:
    if not url or not url.strip():
        return None
    url = url.strip()
    match = re.search(r"leetcode\.com/u/([^/?#]+)", url)
    if match:
        return match.group(1).strip()
    match = re.search(r"leetcode\.com/([^/?#]+)", url)
    if match and match.group(1) not in ("u", "problems", "contest"):
        return match.group(1).strip()
    return url.replace("https://leetcode.com/u/", "").replace("https://leetcode.com/", "").replace("/", "").strip()


def run_import():
    db = SessionLocal()
    print("=== IMPORTING IV YEAR CSE(CS) & CSE(IOT) ROSTER ===")
    
    depts = {d.code: d for d in db.query(Department).all()}
    
    added_count = 0
    updated_count = 0

    for item in IV_YEAR_DATA:
        reg_no = item["reg_no"]
        short_reg = item["short_reg"]
        dept_code = item["dept"]
        dept = depts.get(dept_code)
        if not dept:
            print(f"[ERROR] Unknown department: {dept_code}")
            continue

        raw_url = item["url"].strip()
        username = extract_username(raw_url)
        formatted_url = f"https://leetcode.com/u/{username}/" if username else None

        # Check existing by long or short reg_no
        student = db.query(Student).filter(
            (Student.reg_no == reg_no) | (Student.reg_no == short_reg)
        ).first()

        if not student:
            student = Student(
                reg_no=reg_no,
                name=item["name"],
                department_id=dept.id,
                year_level="IV",
                leetcode_url=formatted_url,
                username=username,
                is_active=True
            )
            db.add(student)
            db.flush()
            added_count += 1

            # Stats
            stats = LeetCodeProfileStats(
                student_id=student.id,
                total_solved=0,
                easy_solved=0,
                medium_solved=0,
                hard_solved=0,
                contest_rating=None,
                active_days=0,
                max_streak=0
            )
            db.add(stats)
            db.flush()

            # Profile & Problem Stats
            prof = LeetCodeProfile(
                student_id=student.id,
                canonical_username=username,
                profile_url=formatted_url,
                verification_status="PROFILE_VERIFIED" if username else "PENDING_USERNAME",
                sync_state="PENDING" if username else "MISSING_LINK"
            )
            db.add(prof)

            prob = LeetCodeProblemStats(student_id=student.id, total_solved=0, easy_solved=0, medium_solved=0, hard_solved=0)
            db.add(prob)

        else:
            # Update existing
            student.name = item["name"]
            student.department_id = dept.id
            student.year_level = "IV"
            student.leetcode_url = formatted_url
            student.username = username
            student.is_active = True
            updated_count += 1

    db.commit()
    print(f"[IMPORT_SUCCESS] Processed {len(IV_YEAR_DATA)} IV-Year Students:")
    print(f"  + Added: {added_count}")
    print(f"  + Updated: {updated_count}")
    print(f"Total Students in Database: {db.query(Student).count()}")
    
    # Check IV year counts
    iv_cs = db.query(Student).filter(Student.department_id == depts["CSE(CS)"].id, Student.year_level == "IV").count()
    iv_iot = db.query(Student).filter(Student.department_id == depts["CSE(IOT)"].id, Student.year_level == "IV").count()
    print(f"Verified Counts -> IV Year CSE(CS): {iv_cs} | IV Year CSE(IOT): {iv_iot}")
    
    db.close()


if __name__ == "__main__":
    run_import()
