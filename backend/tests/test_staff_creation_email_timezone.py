import datetime
from zoneinfo import ZoneInfo
from unittest.mock import patch
import pytest

from backend.time_utils import ensure_ist
from backend.services.email_notifications import notify_admin_staff_created

def test_timezone_conversion_utc_to_ist_case_1():
    # UTC: 2026-09-11 00:46:00 UTC -> expected IST: 11 September 2026, 06:16 AM IST
    dt_utc = datetime.datetime(2026, 9, 11, 0, 46, 0, tzinfo=datetime.timezone.utc)
    dt_ist = ensure_ist(dt_utc)
    
    assert dt_ist.strftime("%d %B %Y") == "11 September 2026"
    assert dt_ist.strftime("%I:%M %p IST") == "06:16 AM IST"

def test_timezone_conversion_utc_to_ist_date_boundary():
    # UTC: 2026-09-10 20:00:00 UTC -> expected IST: 11 September 2026, 01:30 AM IST
    dt_utc = datetime.datetime(2026, 9, 10, 20, 0, 0, tzinfo=datetime.timezone.utc)
    dt_ist = ensure_ist(dt_utc)
    
    assert dt_ist.strftime("%d %B %Y") == "11 September 2026"
    assert dt_ist.strftime("%I:%M %p IST") == "01:30 AM IST"

@patch("backend.services.email_notifications.send_email")
def test_notify_admin_staff_created_email_rendering(mock_send_email):
    # Stored UTC timestamp: 2026-09-11 00:46:00 UTC
    dt_utc = datetime.datetime(2026, 9, 11, 0, 46, 0, tzinfo=datetime.timezone.utc)
    
    staff_data = {
        "full_name": "Test Staff Member",
        "role": "Staff Mentor",
        "department": "Computer Science and Engineering (Cyber Security)",
        "email": "24cc031@nandhaengg.org",
        "status": "Active",
        "created_at": dt_utc,
        "account_id": "ACC-000045",
        "staff_id": "NEC-STAFF-FAC-D86F",
        "permissions": []
    }
    
    admin_data = {
        "created_by": "System Administrator (Super Admin)"
    }
    
    event_data = {
        "event_id": "EVT-STAFF-45-1789087560",
        "timestamp": "11 September 2026, 06:16 AM IST"
    }
    
    notify_admin_staff_created(
        admin_email="admin@nandhaengg.org",
        staff_data=staff_data,
        admin_data=admin_data,
        event_data=event_data
    )
    
    assert mock_send_email.called
    args, kwargs = mock_send_email.call_args
    assert kwargs.get("to_email") == "admin@nandhaengg.org" or args[0] == "admin@nandhaengg.org"
    
    html_body = kwargs.get("html_body") or args[2]
    
    # Check rendered timestamps
    assert "11 September 2026" in html_body
    assert "06:16 AM IST" in html_body
    
    # Check fixed label column styling and 2-column layout
    assert "width:170px" in html_body
    assert "min-width:170px" in html_body
    assert "vertical-align:top" in html_body
    
    # Check specific fields
    assert "DESIGNATION / ROLE" in html_body
    assert "Staff Mentor" in html_body
    assert "Computer Science and" in html_body
    assert "24cc031@nandhaengg.org" in html_body
    assert "ACC-000045" in html_body
    assert "NEC-STAFF-FAC-D86F" in html_body
