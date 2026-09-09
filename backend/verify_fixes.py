from backend.database import Base
from sqlalchemy import Column, Integer, String, ForeignKey, create_engine
from sqlalchemy.orm import relationship, Session, declarative_base

TestBase = declarative_base()

class Student(TestBase):
    __tablename__ = "students"
    id = Column(Integer, primary_key=True)

class User(TestBase):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)

class ActionA(TestBase):
    __tablename__ = "action_table"
    __table_args__ = {"extend_existing": True}
    id = Column(Integer, primary_key=True)
    student_id = Column(Integer, ForeignKey("students.id"))
    
    student = relationship("Student", primaryjoin="Student.id == foreign(ActionA.student_id)")

class ActionB(TestBase):
    __tablename__ = "action_table"
    __table_args__ = {"extend_existing": True}
    id = Column(Integer, primary_key=True)
    student_id = Column(Integer, ForeignKey("students.id"))
    
    student = relationship("Student", primaryjoin="Student.id == foreign(ActionB.student_id)")

engine = create_engine('sqlite:///:memory:')
TestBase.metadata.create_all(engine)
print("SUCCESS")
