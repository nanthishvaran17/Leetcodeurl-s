import os
from backend.database import SessionLocal
from backend.services.canonical_contest_engine import build_canonical_contest_dataset
from backend.exporters.excel_exporter import export_excel_from_dataset

def generate_cse_cs_iii_year_excel():
    db = SessionLocal()
    dataset = build_canonical_contest_dataset(
        session_id=21,
        db=db,
        dept="CSE(CS)",
        year="III",
        attendance="ALL"
    )
    
    excel_bytes = export_excel_from_dataset(dataset)
    
    os.makedirs("reports", exist_ok=True)
    out_path = "reports/Nandha_Engineering_College_Weekly_Contest_516_CSE_Cyber_Security_III_Year.xlsx"
    with open(out_path, "wb") as f:
        f.write(excel_bytes)
        
    print(f"SUCCESS: Generated {out_path} ({len(excel_bytes)} bytes)")
    print(f"Total Cohort Rows: {len(dataset.get('rows', []))}")
    print(f"Public Solvers: {dataset.get('metrics', {}).get('officialAttended')}")

if __name__ == "__main__":
    generate_cse_cs_iii_year_excel()
