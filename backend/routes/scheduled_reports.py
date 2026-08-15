from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, EmailStr

from backend.database import get_db
from backend.services.schedule_service import (
    get_schedule_status,
    save_report_schedule,
    toggle_report_schedule,
    execute_scheduled_report_pipeline,
    get_execution_history
)
from backend.routes.auth import get_current_user
from backend.models import User
from backend.logger import logger

router = APIRouter(prefix="/api/system/schedule", tags=["Scheduled Report Automation"])


class SaveScheduleSchema(BaseModel):
    report_name: Optional[str] = "Weekly Public LeetCode Report"
    day_of_week: str = "sunday"
    hour: int = 9
    minute: int = 45
    timezone: str = "Asia/Kolkata"
    recipients: List[str]
    is_enabled: bool = True


class ToggleScheduleSchema(BaseModel):
    is_enabled: bool


class TestRunSchema(BaseModel):
    test_recipient: Optional[str] = None


@router.get("")
def get_scheduled_report_status(db: Session = Depends(get_db)):
    """
    Returns authoritative schedule status, next run in Asia/Kolkata, scheduler state, and email service health.
    """
    try:
        return get_schedule_status(db)
    except Exception as e:
        logger.error(f"Error fetching schedule status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("")
def save_scheduled_report_configuration(
    payload: SaveScheduleSchema,
    db: Session = Depends(get_db)
):
    """
    Saves and persists administrator schedule configuration and reconfigures APScheduler.
    """
    try:
        res = save_report_schedule(
            db=db,
            data=payload.dict(),
            admin_email="Administrator"
        )
        return res
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"Error saving schedule: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/toggle")
def toggle_schedule_state(
    payload: ToggleScheduleSchema,
    db: Session = Depends(get_db)
):
    """
    Enables or disables scheduled report automation.
    """
    try:
        res = toggle_report_schedule(
            db=db,
            enable=payload.is_enabled,
            admin_email="Administrator"
        )
        return res
    except Exception as e:
        logger.error(f"Error toggling schedule: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/test-run")
async def run_safe_test_execution(
    payload: TestRunSchema,
    db: Session = Depends(get_db)
):
    """
    Runs a safe test execution (dry run / sandbox mode). Does not consume real Sunday idempotency key.
    """
    try:
        res = await execute_scheduled_report_pipeline(
            db=db,
            is_test_run=True,
            test_recipient=payload.test_recipient
        )
        return res
    except Exception as e:
        logger.error(f"Error executing test run: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history")
def get_scheduled_report_history(
    limit: int = Query(15, ge=1, le=50),
    db: Session = Depends(get_db)
):
    """
    Returns recent chronological execution history logs with status and timestamps.
    """
    try:
        return get_execution_history(db=db, limit=limit)
    except Exception as e:
        logger.error(f"Error retrieving execution history: {e}")
        raise HTTPException(status_code=500, detail=str(e))
