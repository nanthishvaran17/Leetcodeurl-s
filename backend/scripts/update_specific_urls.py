import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.database import SessionLocal
from backend.models import Student, LeetCodeProfileStats
from backend.scripts.import_fresh_students_dataset import generate_canonical_roster
from backend.cache import cache

UPDATES = {
    "732224CC002": ("AMRUTHA M", "Amruthauma"),
    "732224CC003": ("ANUSHKUMAR R", "Anushkumar006"),
    "732224CC004": ("BHARATH G", "BHARATH1927"),
    "732224CC005": ("DHANUSHYA GK", "dhanu2006"),
    "732224CC008": ("DHARUNRAJ KP", "K_P_DHARUNRAJ"),
    "732224CC009": ("GIRIPATHI K", "Giripathi_k"),
    "732224CC015": ("HARISH N", "Har-ish23"),
    "732224CC038": ("RADHISRI", "Radhisri28"),
    "732224CC039": ("RAJESH R", "raj1328"),
    "732224CC041": ("RITHIKA J", "Rithu04162006"),
    "732224CC046": ("SHANMUGA PRIYA J", "Priya_1410"),
    "732224CC052": ("SUPRIYA K", "K_supriya_01"),
    "732224CC053": ("SURESH S", "suresh11092006"),
    "732224CC059": ("YURJEEN J", "4Nfn0FHIyV"),
    "732224CC060": ("YUVANESH S", "kBU8ALVGdd"),
    "732224CCL01": ("MOHAMMED AFFAN JA", "affan781"),
    "732224CCL02": ("SARAN R", "Saranraj_2580"),
    "732224CCL03": ("SHREE SANJAY U K", "shreesanjay"),
    "732224CCL04": ("SRIDHAR S", "sridhar320076"),
}

def update():
    db = SessionLocal()
    for reg_no, (name, uname) in UPDATES.items():
        st = db.query(Student).filter(Student.reg_no == reg_no).first()
        if st:
            st.username = uname
            st.leetcode_url = f"https://leetcode.com/u/{uname}/"
            if name and not st.name:
                st.name = name
            
            stats = db.query(LeetCodeProfileStats).filter(LeetCodeProfileStats.student_id == st.id).first()
            if stats:
                stats.sync_status = "not_started"
                stats.status = "pending"
            print(f"Updated {reg_no}")
    try:
        db.commit()
    except Exception as e:
        print("Error committing:", e)
        db.rollback()
    db.close()
    
    # re-generate
    db = SessionLocal()
    generate_canonical_roster(db)
    db.close()
    cache.clear()

if __name__ == "__main__":
    update()
