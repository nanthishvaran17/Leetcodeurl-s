# generate_clean_report.py
import pandas as pd
import os
import sys
from datetime import datetime
from zoneinfo import ZoneInfo
from contest_report import process_student_data, generate_summary, export_excel, export_pdf

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

IST = ZoneInfo("Asia/Kolkata")

def main():
    df = pd.read_excel("students.xlsx")
    contest_date = datetime.strptime("2026-08-09", "%Y-%m-%d").replace(tzinfo=IST)
    contest_slug = "weekly-contest-514"
    
    print(f"Generating clean reports for {contest_slug}...")
    results = process_student_data(df, contest_slug, contest_date)
    summary = generate_summary(results)
    
    excel_file = export_excel(results, summary, contest_date)
    pdf_file = f"report_{contest_date.strftime('%Y-%m-%d')}.pdf"
    export_pdf(results, summary, contest_date, pdf_file)
    print(f"✅ Generated {excel_file} and {pdf_file}")

if __name__ == "__main__":
    main()
