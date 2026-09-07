"""
conftest.py — Global Pytest Fixtures for Nandha LeetCode Intelligence Test Suite.
"""

import pytest
from sqlalchemy.orm import Session
from fastapi.testclient import TestClient

from backend.database import SessionLocal
from backend.main import app


@pytest.fixture(scope="session", autouse=True)
def setup_database():
    """Ensure the database schema is fully created before any tests run in the session."""
    from backend.database import engine
    from backend.models import Base
    Base.metadata.create_all(bind=engine)
    yield

@pytest.fixture(scope="function")
def db() -> Session:
    """Yield a database session and safely close it after test completion."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture(scope="function")
def client() -> TestClient:
    """Yield a FastAPI TestClient instance."""
    return TestClient(app)
