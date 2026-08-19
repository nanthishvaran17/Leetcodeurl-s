# generate_sunday_reports.py
import pandas as pd
import sys
from datetime import datetime
from zoneinfo import ZoneInfo
from sunday_automation_complete import (
    load_students_roster,
    process_students_with_timestamps,
    generate_two_reports,
    send_email,
    IST
)

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

def main():
    contest_slug = "weekly-contest-514"
    contest_date = datetime(2026, 8, 9, tzinfo=IST)
    
    print(f"Loading students...")
    students = load_students_roster()
    print(f"Loaded {len(students)} students.")
    
    print(f"Processing students for {contest_slug}...")
    results = process_students_with_timestamps(students, contest_slug, contest_date)
    
    print(f"Generating dual reports...")
    reports = generate_two_reports(results, contest_slug, contest_date)
    
    print("\n" + "=" * 60)
    print("📊 DUAL REPORTS GENERATED SUCCESSFULLY")
    print("=" * 60)
    print(f"  • 🟢 LIVE (Official):    {reports['live']} ({round(reports['live']/reports['total']*100, 1)}%)")
    print(f"  • 🟣 VIRTUAL (Post 9:30): {reports['virtual']} ({round(reports['virtual']/reports['total']*100, 1)}%)")
    print(f"  • 🔴 NOT ATTENDED:        {reports['not_attended']} ({round(reports['not_attended']/reports['total']*100, 1)}%)")
    print(f"\n📁 Saved Excel Reports:")
    print(f"  • Internal: {reports['internal_file']}")
    print(f"  • External: {reports['external_file']}")
    print("\n⏰ Virtual Breakdown:")
    for t, c in sorted(reports['virtual_times'].items()):
        print(f"  - {t}: {c} students")

if __name__ == "__main__":
    main()
