"""
conftest.py — Global Pytest Fixtures for Nandha LeetCode Intelligence Test Suite.
"""

import pytest
from sqlalchemy.orm import Session
from fastapi.testclient import TestClient

from backend.database import SessionLocal
from backend.main import app


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
