import os, sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from backend.assets.reseed_all_stats import reseed_all_student_stats

if __name__ == "__main__":
    reseed_all_student_stats()
