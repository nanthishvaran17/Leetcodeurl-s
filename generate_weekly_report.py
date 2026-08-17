"""
Automated Weekly LeetCode Performance Report CLI Generator
Consumes SQLite database in READ-ONLY mode.
Generates institutional Excel (.xlsx), PDF (.pdf), and Word (.docx) reports.
"""
import os
import sys
import argparse
import datetime

# Ensure project root is in python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend.database import SessionLocal
from backend.services.weekly_report_service import generate_weekly_performance_data
from backend.exporters.weekly_excel_generator import build_weekly_performance_excel
from backend.pdf_generator import build_weekly_performance_pdf
from backend.word_generator import build_weekly_performance_docx
from backend.logger import logger


def main():
    parser = argparse.ArgumentParser(description="Canonical Weekly LeetCode Performance Reporting System")
    parser.add_argument("--date", type=str, default=datetime.date.today().strftime("%d-%m-%Y"), help="Report Date (DD-MM-YYYY)")
    parser.add_argument("--last-week", type=int, default=None, help="Last week contest number override (e.g. 513)")
    parser.add_argument("--current-week", type=int, default=None, help="Current week contest number override (e.g. 514)")
    parser.add_argument("--formats", type=str, default="xlsx,pdf,docx", help="Comma-separated report formats (xlsx,pdf,docx)")
    parser.add_argument("--output-dir", type=str, default=".", help="Output directory for generated files")
    parser.add_argument("--no-snapshot", action="store_true", help="Skip saving snapshot to database")

    args = parser.parse_args()

    report_date_str = args.date
    output_dir = os.path.abspath(args.output_dir)
    os.makedirs(output_dir, exist_ok=True)

    requested_formats = [f.strip().lower() for f in args.formats.split(",") if f.strip()]
    if "all" in requested_formats:
        requested_formats = ["xlsx", "pdf", "docx"]

    db = SessionLocal()

    try:
        logger.info(
            f"Compiling Canonical Weekly Performance Report for date: {report_date_str} "
            f"(last_week: {args.last_week}, current_week: {args.current_week})..."
        )
        
        # Canonical single dataset generation (DB read-only)
        data = generate_weekly_performance_data(
            db,
            last_week_contest=args.last_week,
            current_week_contest=args.current_week,
            report_date=report_date_str,
            save_snapshot=not args.no_snapshot
        )

        generated_files = []

        # 1. Generate Excel (.xlsx)
        if "xlsx" in requested_formats or "excel" in requested_formats:
            xlsx_filename = f"LeetCode_Weekly_Report_{report_date_str}.xlsx"
            xlsx_filepath = os.path.join(output_dir, xlsx_filename)
            logger.info(f"Generating Excel workbook: {xlsx_filepath}...")
            actual_xlsx = build_weekly_performance_excel(data, xlsx_filepath)
            generated_files.append(actual_xlsx)

        # 2. Generate PDF (.pdf)
        if "pdf" in requested_formats:
            pdf_filename = f"LeetCode_Weekly_Report_{report_date_str}.pdf"
            pdf_filepath = os.path.join(output_dir, pdf_filename)
            logger.info(f"Generating PDF report: {pdf_filepath}...")
            pdf_bytes = build_weekly_performance_pdf(data)
            with open(pdf_filepath, "wb") as f:
                f.write(pdf_bytes)
            generated_files.append(pdf_filepath)

        # 3. Generate Word (.docx)
        if "docx" in requested_formats or "word" in requested_formats:
            docx_filename = f"LeetCode_Weekly_Report_{report_date_str}.docx"
            docx_filepath = os.path.join(output_dir, docx_filename)
            logger.info(f"Generating DOCX report: {docx_filepath}...")
            docx_bytes = build_weekly_performance_docx(data)
            with open(docx_filepath, "wb") as f:
                f.write(docx_bytes)
            generated_files.append(docx_filepath)

        curr_sess = data.get("current_session", {})
        last_sess = data.get("last_session", {})

        print("\n" + "=" * 75)
        print("LEETCODE WEEKLY PERFORMANCE REPORT GENERATED SUCCESSFULLY")
        print("=" * 75)
        print(f"Report Date:              {data.get('report_date')}")
        print(f"Current Contest:          {curr_sess.get('contest_name')} (#{curr_sess.get('contest_number')})")
        print(f"Last Contest:             {last_sess.get('contest_name')} (#{last_sess.get('contest_number')})")
        print(f"Resolution Mode:          {data.get('session_resolution', {}).get('resolution_mode')}")
        print(f"Total Master Students:    {data.get('total_students')}")
        print(f"Successfully Verified:    {data.get('verified_students')}")
        print(f"Data Unavailable/Failed:  {data.get('unavailable_students')}")
        print("\nGenerated Report Artifacts:")
        for g_file in generated_files:
            print(f"  * {os.path.basename(g_file)} ({os.path.getsize(g_file):,} bytes)")
        print("=" * 75 + "\n")

    except Exception as e:
        logger.error(f"Failed to generate weekly report: {e}", exc_info=True)
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()
