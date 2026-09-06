"""
conftest.py — Global Pytest Fixtures for Nandha LeetCode Intelligence Test Suite.
"""

import pytest
from sqlalchemy.orm import Session
from fastapi.testclient import TestClient

from backend.database import SessionLocal, run_migrations
from backend.main import app


@pytest.fixture(scope="session", autouse=True)
def ensure_test_schema() -> None:
    """Ensure SQLite test schema exists before any tests execute."""
    run_migrations()


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
