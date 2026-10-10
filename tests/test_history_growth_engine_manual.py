import datetime
from zoneinfo import ZoneInfo
from typing import Optional

def test_growth_cutoff():
    from backend.routes.history import _growth_cutoff
    now_ist = datetime.datetime.now(ZoneInfo("Asia/Kolkata"))
    start_of_today_ist = now_ist.replace(hour=0, minute=0, second=0, microsecond=0)
    
    cutoff_today = _growth_cutoff("today")
    assert cutoff_today == start_of_today_ist.astimezone(datetime.timezone.utc), f"today cutoff mismatch: {cutoff_today} != {start_of_today_ist.astimezone(datetime.timezone.utc)}"
    
    cutoff_7d = _growth_cutoff("7d")
    assert cutoff_7d == (start_of_today_ist - datetime.timedelta(days=6)).astimezone(datetime.timezone.utc), "7d cutoff mismatch"
    
    cutoff_30d = _growth_cutoff("30d")
    assert cutoff_30d == (start_of_today_ist - datetime.timedelta(days=29)).astimezone(datetime.timezone.utc), "30d cutoff mismatch"
    print("Cutoff tests passed.")

def test_cal_entries_and_sum_delta():
    from backend.routes.history import _parse_cal_entries, _get_target_dates, _sum_cal_delta, IST_TZ, UTC_TZ
    now_ist = datetime.datetime.now(IST_TZ)
    now_utc = datetime.datetime.now(UTC_TZ)
    
    # Today's timestamp
    ts_today = int(now_ist.timestamp())
    raw_cal = f'{{"{ts_today}": 5}}'
    
    entries = _parse_cal_entries(raw_cal)
    assert len(entries) == 1
    assert entries[0] == (ts_today, 5)
    
    target_dates_today = _get_target_dates("today", now_ist.date(), now_utc.date())
    delta = _sum_cal_delta(entries, target_dates_today)
    assert delta == 5, f"Expected 5, got {delta}"
    
    # Yesterday's timestamp
    ts_yest = int((now_ist - datetime.timedelta(days=2)).timestamp())
    raw_cal_yest = f'{{"{ts_yest}": 3}}'
    entries_yest = _parse_cal_entries(raw_cal_yest)
    delta_yest = _sum_cal_delta(entries_yest, target_dates_today)
    assert delta_yest == 0, f"Expected 0 for 2 days ago in today filter, got {delta_yest}"

if __name__ == "__main__":
    test_growth_cutoff()
    test_cal_entries_and_sum_delta()

