import sys
import os

# Add the project root to the python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.database import SessionLocal
from backend.models import Student

data = """
23CC001 AATHAVAN T ZMA0bkSWmY
23CC002 S.ABIRAMI ShtLj6CNJL
23CC003 ASWIN P Aswinp33
23CC005 BHARATH I Bharath_77
23CC007 DEEPADHARSHINI C deepadharshini_10
23CC009 DEEPAKKUMAR E Deepak1524
23CC010 DEEPAKKUMAR M deepakmahes56
23CC013 ENIYAVAN R Eniyavan__r
23CC017 JANARANSHINI P Janaranshini
23CC020 KANISHAA.K.S kani_shaa
23CC021 KANISKA N J ka_nizzu29
23CC023 KAVINRAJAN K kavinrajan
23CC025 KEERTHANA B Keerthu-2005
23CC031 MOWNAVARTHINI A L 23cc031
23CC038 PRAVEEN KUMAR J PRAVEEN360
23CC039 PRAVEEN VENKATESH A V pravexn
23CC042 PRIYADHARSHINI K 23cc042
23CC043 RAGAVAN S 23cc043
23CC044 RAM PRAKASH S Ramprakash5
23CC045 RATHEESH S ratheesh1226
23CC046 RITHIKA P rithikap13
23CC047 SARAVANAN R SARAVANAN_ROLEX
23CC050 SRIVIDHYA S SRIVIDHYA_25
23CC051 SRIRAM.S Sriram51
23CC052 STEFFY MARTINA P Steffy_15
23CC053 SUBITHA P S 23cc053
23CC056 VIGNESH J vignesh_2397
23CC059 WASIM M M_wasim
"""

def update_students():
    db = SessionLocal()
    try:
        updated_count = 0
        reg_to_user = {}
        for line in data.strip().split('\n'):
            parts = line.strip().split()
            if len(parts) >= 3:
                reg_to_user[parts[0]] = parts[-1]
                
        # Handle the 7322 prefix safely
        all_students = db.query(Student).filter(Student.department_id == 1).all() # Dept 1 is CSE(CS) usually, let's just get all and filter in memory since 300 students is tiny.
        
        for student in db.query(Student).all():
            for reg, username in reg_to_user.items():
                if student.reg_no.endswith(reg):
                    student.leetcode_url = f"https://leetcode.com/u/{username}/"
                    student.username = username
                    updated_count += 1
                    print(f"Updated {student.reg_no}: username={username}")
                    
        db.commit()
        print(f"Successfully updated {updated_count} students.")
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    update_students()
