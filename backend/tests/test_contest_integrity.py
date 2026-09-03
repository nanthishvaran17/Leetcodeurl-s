import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.models import Base, Student, LeetCodeAccount, StudentContestParticipation, IntegrityCase
from backend.services.contest_integrity_service import ContestIntegrityService

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture
def db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)

def create_student_with_accounts(db, people_id="P001", name="Test Student", num_accounts=2):
    student = Student(people_id=people_id, reg_no=people_id, name=name, department_id=1, section_id=1, year_level="III")
    db.add(student)
    db.commit()
    db.refresh(student)

    accounts = []
    for i in range(num_accounts):
        acc = LeetCodeAccount(student_id=student.id, leetcode_username=f"user_{people_id}_{i+1}")
        db.add(acc)
        accounts.append(acc)
    db.commit()
    return student, accounts

# Case 1: Account A: Attended, Account B: Not Attended -> NO ALERT
def test_case_1_one_attended_one_not(db):
    student, accounts = create_student_with_accounts(db, "P101", "Student 1")
    
    # Account A: Attended
    db.add(StudentContestParticipation(
        student_id=student.id, contest_id="contest-100", contest_name="Weekly Contest 100", participation_mode=f"PUBLIC_{accounts[0].leetcode_username}",
        score_display="3 / 4", questions_solved=3, source=f"leetcode_official_{accounts[0].leetcode_username}"
    ))
    # Account B: Not Attended
    db.add(StudentContestParticipation(
        student_id=student.id, contest_id="contest-100", contest_name="Weekly Contest 100", participation_mode=f"PUBLIC_{accounts[1].leetcode_username}",
        score_display="Not Attended", questions_solved=0, source=f"leetcode_official_{accounts[1].leetcode_username}"
    ))
    db.commit()

    service = ContestIntegrityService(db)
    cases = service.evaluate_contest_integrity("contest-100")
    assert len(cases) == 0

# Case 4: Account A: Not Attended, Account B: Not Attended -> TRIGGER DUAL-ID ALERT
def test_case_4_both_not_attended(db):
    student, accounts = create_student_with_accounts(db, "P104", "Student 4")
    
    # Account A: Not Attended
    db.add(StudentContestParticipation(
        student_id=student.id, contest_id="contest-100", contest_name="Weekly Contest 100", participation_mode=f"PUBLIC_{accounts[0].leetcode_username}",
        score_display="Not Attended", questions_solved=0, source=f"leetcode_official_{accounts[0].leetcode_username}"
    ))
    # Account B: Not Attended
    db.add(StudentContestParticipation(
        student_id=student.id, contest_id="contest-100", contest_name="Weekly Contest 100", participation_mode=f"PUBLIC_{accounts[1].leetcode_username}",
        score_display="Not Attended", questions_solved=0, source=f"leetcode_official_{accounts[1].leetcode_username}"
    ))
    db.commit()

    service = ContestIntegrityService(db)
    cases = service.evaluate_contest_integrity("contest-100")
    assert len(cases) == 1
    assert cases[0]["people_id"] == "P104"
    assert cases[0]["status"] == "PENDING"

# Case 5: Account A: Unknown / Sync Failed, Account B: Not Attended -> NO ALERT
def test_case_5_unknown_and_not_attended(db):
    student, accounts = create_student_with_accounts(db, "P105", "Student 5")
    
    # Account A: Unknown
    db.add(StudentContestParticipation(
        student_id=student.id, contest_id="contest-100", contest_name="Weekly Contest 100", participation_mode=f"PUBLIC_{accounts[0].leetcode_username}",
        score_display="UNKNOWN", questions_solved=None, source=f"leetcode_official_{accounts[0].leetcode_username}"
    ))
    # Account B: Not Attended
    db.add(StudentContestParticipation(
        student_id=student.id, contest_id="contest-100", contest_name="Weekly Contest 100", participation_mode=f"PUBLIC_{accounts[1].leetcode_username}",
        score_display="Not Attended", questions_solved=0, source=f"leetcode_official_{accounts[1].leetcode_username}"
    ))
    db.commit()

    service = ContestIntegrityService(db)
    cases = service.evaluate_contest_integrity("contest-100")
    assert len(cases) == 0

# Case 7: Single Account -> NO ALERT
def test_case_7_single_account(db):
    student, accounts = create_student_with_accounts(db, "P107", "Student 7", num_accounts=1)
    
    db.add(StudentContestParticipation(
        student_id=student.id, contest_id="contest-100", contest_name="Weekly Contest 100", participation_mode=f"PUBLIC_{accounts[0].leetcode_username}",
        score_display="Not Attended", questions_solved=0, source=f"leetcode_official_{accounts[0].leetcode_username}"
    ))
    db.commit()

    service = ContestIntegrityService(db)
    cases = service.evaluate_contest_integrity("contest-100")
    assert len(cases) == 0

# Case 8: Account A: Not Attended, Account B: Not Attended, Account C: Attended -> NO ALERT
def test_case_8_three_accounts_one_attended(db):
    student, accounts = create_student_with_accounts(db, "P108", "Student 8", num_accounts=3)
    
    # Account A: Not Attended
    db.add(StudentContestParticipation(
        student_id=student.id, contest_id="contest-100", contest_name="Weekly Contest 100", participation_mode=f"PUBLIC_{accounts[0].leetcode_username}",
        score_display="Not Attended", questions_solved=0, source=f"leetcode_official_{accounts[0].leetcode_username}"
    ))
    # Account B: Not Attended
    db.add(StudentContestParticipation(
        student_id=student.id, contest_id="contest-100", contest_name="Weekly Contest 100", participation_mode=f"PUBLIC_{accounts[1].leetcode_username}",
        score_display="Not Attended", questions_solved=0, source=f"leetcode_official_{accounts[1].leetcode_username}"
    ))
    # Account C: Attended
    db.add(StudentContestParticipation(
        student_id=student.id, contest_id="contest-100", contest_name="Weekly Contest 100", participation_mode=f"PUBLIC_{accounts[2].leetcode_username}",
        score_display="4 / 4", questions_solved=4, source=f"leetcode_official_{accounts[2].leetcode_username}"
    ))
    db.commit()

    service = ContestIntegrityService(db)
    cases = service.evaluate_contest_integrity("contest-100")
    assert len(cases) == 0
