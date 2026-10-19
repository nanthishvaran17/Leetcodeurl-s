import sys
import os
import asyncio
from sqlalchemy import select
from backend.database import get_db, SessionLocal
from backend.models import Student

# Data extracted from user prompt
data = """732224CCL03
Shree Sanjay U K
CSE(CS)
3rd Year
https://leetcode.com/u/shreesanjay/
732224CCL02
Saran R
CSE(CS)
3rd Year
732224CCL04
Sridhar S
CSE(CS)
3rd Year
732224CC005
DHANUSHYA GK
CSE(CS)
3rd Year
https://leetcode.com/u/dhanu2006/
732224CC002
AMRUTHA M
CSE(CS)
3rd year
https://leetcode.com/u/Amruthauma/
732224CC004
BHARATH G
CSE(CS)
3rd year
https://leetcode.com/u/BHARATH1927/
732224CC008
DHARUNRAJ K P
CSE(CS)
3rd Year
https://leetcode.com/u/K_P_DHARUNRAJ/
732224CC007
DHARSHINI S M
CSE(CS)
3 rd year
https://leetcode.com/u/Dharshini90989/
732224CC003
Anush kumar R
CSE(CS)
3 rd year
https://leetcode.com/u/Anushkumar006/
732224CC011
HARDIKA M
CSE(CS)
3rd year
https://leetcode.com/u/hardi04/
732224CC015
HARISH N
CSE(CS)
3rd year
https://leetcode.com/u/Har-ish23/
732224CC016
Iniya K
CSE (CS)
3 rd year
https://leetcode.com/u/Iniya_26/
732224CC021
Kiruthikaa P.T
CSE(CS)
3rd Year
https://leetcode.com/u/KIRUTHIKAA_05/
732224CC023
Laksana S
CSE(CS)
3rd Year
https://leetcode.com/u/Laksana_Subramanian
732224CC026
Mahilnethra SK
CSE(CS)
3rd year
https://leetcode.com/u/m8nHl98epy/
732224cc027
Manjunath D
CSE(CS)
3rd year
https://leetcode.com/u/Wolvynmanju/
732224CC033
Nithin S
CSE (CS)
3rd year
https://leetcode.com/u/Nithin_3126/
732224CC034
Nivethytha JR.R
CSE(CS)
3rd year
https://leetcode.com/u/nivethytha/
732224CC035
K.S.POOMITHA
CSE(CS)
3rd year
https://leetcode.com/u/Poomitha_236/
732224CC038
RADHISRI N
CSE(CS)
3rd year
https://leetcode.com/u/Radhisri28/
732224CC039
RAJESH R
CSE(CS)
3rd year
https://leetcode.com/u/raj1328/
732224CC040
Rithanika V
CSE(CS)
3rd year
https://leetcode.com/u/Rithanika_Venakatachalam
732224CC041
Rithika J
CSE(CS)
3rd year
https://leetcode.com/u/Rithu04162006/
732224CC044
Sakthi S
CSE(CS)
3rd year
https://leetcode.com/u/sakthi0407/
732224CC045
Shandeesh R P
CSE(CS)
3rd year
https://leetcode.com/u/shandeesh8667/
732224CC046
Shanmuga Priya J
CSE(CS)
3rd year
https://leetcode.com/u/Priya_1410/
732224CC047
Sharmila P
CSE(CS)
3rd year
https://leetcode.com/u/Sharmila___07/
732224CC048
Sowmiya S
CSE(CS)
3rd
https://leetcode.com/u/Sowmiya_7383/
732224CC052
K.supriya
CSE(cs)
3rd year
https://leetcode.com/u/K_supriya_01/
732224CC053
suresh S
CSE(CS)
3rd year
https://leetcode.com/u/suresh11092006/
732224CC054
Varshini Devi K
CSE(CS)
3rd year
https://leetcode.com/u/Varshini_0711/
732224CC056
Vignesh T
CSE(CS)
3rd year
https://leetcode.com/u/vignesh_1112/
732224CC058
YAZHINI SHREE.A
CSE(CS)
3rd year
https://leetcode.com/u/yazhu_shree/
732224CC060
YUVANESH S
CSE(CS)
3rd year
https://leetcode.com/u/fEPQqVUwv6/
732224CC001
AJAY A
CSE(CS)
3rd Year
https://leetcode.com/u/Ajay1208
732224CI015
A.Jesra Begam
CSE-IoT
3rd Year
https://leetcode.com/u/jesra105/
732224CI037
PRAJIN SANKAR AU
CSE-IoT
3rd Year
https://leetcode.com/u/Prajin_contest/
732224CI057
Vishnu Priyadharshne G.J
CSE-IoT
3rd Year
https://leetcode.com/u/Dharshnee1110
732224CIRO1
SOWMIYA K
CSE-IoT
3rd Year
https://leetcode.com/u/sowmiya__32/
732224CI024
MADHANRAJ A
CSE-IOT
3rd Year
https://leetcode.com/u/Madhanraj_CSE/
732224ci051
SIDDAESHWAR K
CSE-IOT
3rd year
https://leetcode.com/u/Siddu0407/
732224CI033
Naveen.R
CSE-IOT
3rd year
https://leetcode.com/u/naveen_ramesh25/
732224CIL01
KSHIRSAGAR AUM
CSE-IOT
3rd Year
https://leetcode.com/u/24CIL01/
732224CI031
Navanith S R
CSE-IOT
3rd Year
732224CI02
MOHAN K
CSE-IOT
3rd Year
https://leetcode.com/u/kalaigookul
732224CI009
Braveen S
CSE-IOT
3rd Year
https://leetcode.com/u/braveen_sd/
732224CI043
Ranjith Kumar C
CSE-IOT
3rd Year
https://leetcode.com/u/ranjith_43/
732224CI011
Elavarasan.B
CSE-IoT
3rd Year
https://leetcode.com/u/prince_111/
732224CI030
Nandhini G
CSE-IOT
3rd Year
https://leetcode.com/u/Nandhini09_/
732224CI040
RAGHAVAN G
CSE-IOT
3rd year
https://leetcode.com/u/raghav0115/
732224CI026
Meena E
CSE(IoT)
3rd Year
https://leetcode.com/u/MeenaElangovan/
732224CC056
VIGNESH T
CSE-CS
3rd year
https://leetcode.com/u/vignesh_1112/
732224CC015
HARISH N
CSE-CS
3rd year
https://leetcode.com/u/Har-ish23/
"""

def extract_username(url: str) -> str:
    if not url:
        return None
    url = url.strip()
    if not url:
        return None
    
    parts = url.strip('/').split('/')
    if parts:
        return parts[-1]
    return None

def process_data():
    lines = [line.strip() for line in data.strip().split('\n') if line.strip()]
    updates = {}
    
    i = 0
    while i < len(lines):
        # Reg No is the first line of a block
        # Usually it's followed by Name, Dept, Year, and optionally URL
        # We need to detect if the 5th line is a URL or the next Reg No.
        
        reg_no = lines[i]
        
        # Look ahead to find URL
        url = None
        next_i = i + 1
        for j in range(i + 1, min(i + 6, len(lines))):
            if lines[j].startswith("http"):
                url = lines[j]
                next_i = j + 1
                break
            # If we hit a line that looks like a reg no (e.g., starts with digit and is 9-11 chars long)
            # and it's not the first line, then this block doesn't have a URL.
            elif len(lines[j]) >= 10 and lines[j][:2].isdigit() and j > i + 2:
                next_i = j
                break
        else:
            # If we didn't break, jump 4 lines if no URL found
            if url is None:
                next_i = i + 4
                
        if url:
            updates[reg_no.upper()] = url
        
        i = next_i
        
    return updates

async def main():
    updates = process_data()
    print(f"Found {len(updates)} records to update.")
    
    db = SessionLocal()
    try:
        updated_count = 0
        not_found = []
        for reg_no, url in updates.items():
            username = extract_username(url)
            
            # Find student
            student = db.query(Student).filter(Student.reg_no == reg_no).first()
            if student:
                print(f"Updating {reg_no}: {student.leetcode_url} -> {url} (username: {username})")
                student.leetcode_url = url
                if username:
                    student.username = username
                    student.primary_leetcode_id = username
                updated_count += 1
            else:
                print(f"Student {reg_no} not found in DB.")
                not_found.append(reg_no)
                
        db.commit()
        print(f"\\nSuccessfully updated {updated_count} students.")
        if not_found:
            print(f"Could not find these {len(not_found)} students: {', '.join(not_found)}")
            
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(main())
