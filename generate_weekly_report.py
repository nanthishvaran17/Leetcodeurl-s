import os
import sys
import argparse
import datetime

# Ensure project root is in python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend.database import SessionLocal
from backend.services.weekly_report_service import generate_weekly_performance_data
from backend.exporters.weekly_excel_generator import build_weekly_performance_excel
from backend.logger import logger

def main():
    parser = argparse.ArgumentParser(description="Automated Weekly LeetCode Performance Reporting System")
    parser.add_argument("--date", type=str, default=datetime.date.today().strftime("%d-%m-%Y"), help="Report Date (DD-MM-YYYY)")
    parser.add_argument("--output", type=str, default=None, help="Custom output XLSX filename")
    parser.add_argument("--sync", action="store_true", help="Trigger live profile refresh before generating report")
    parser.add_argument("--no-snapshot", action="store_true", help="Skip saving new snapshot to database")

    args = parser.parse_args()

    report_date_str = args.date
    output_filename = args.output or f"LeetCode_Weekly_Report_{report_date_str}.xlsx"
    output_filepath = os.path.join(os.path.dirname(os.path.abspath(__file__)), output_filename)

    db = SessionLocal()

    try:
        if args.sync:
            logger.info("Triggering live profile synchronization prior to report generation...")
            from backend.services.live_sync_service import start_full_sync_job
            sync_res = start_full_sync_job(db, triggered_by="weekly_report_cli")
            logger.info(f"Sync initiated: {sync_res.get('message')}")

        logger.info(f"Compiling Weekly Performance Report for date: {report_date_str}...")
        save_snapshot = not args.no_snapshot
        data = generate_weekly_performance_data(db, report_date=report_date_str, save_snapshot=save_snapshot)

        # Output roster warnings
        if data.get("roster_warnings"):
            for w in data["roster_warnings"]:
                print(f"⚠️ {w}")

        logger.info(f"Generating Excel workbook: {output_filepath}...")
        actual_filepath = build_weekly_performance_excel(data, output_filepath)

        print("\n" + "=" * 70)
        print("LEETCODE WEEKLY PERFORMANCE REPORT GENERATED SUCCESSFULLY")
        print("=" * 70)
        print(f"Report Date:              {data.get('report_date')}")
        print(f"Total Master Students:    {data.get('total_students')}")
        print(f"Successfully Verified:    {data.get('verified_students')}")
        print(f"Data Unavailable/Failed: {data.get('unavailable_students')}")
        print(f"Validation Issues Logged: {len(data.get('validation_issues', []))}")
        print(f"Output File:              {actual_filepath}")
        print("=" * 70 + "\n")

    except Exception as e:
        logger.error(f"Failed to generate weekly report: {e}")
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    main()
