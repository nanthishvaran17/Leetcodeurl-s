import os
from backend.database import SessionLocal
from backend.exporters.excel_exporter import export_excel_from_dataset
from backend.routes.reports import _get_dataset_for_id

def generate_iot_all_years_excel():
    db = SessionLocal()
    
    # Use the same _get_dataset_for_id so it's 100% identical to what download endpoint uses
    dataset, _ = _get_dataset_for_id('Session_21', db, dept='CSE(IOT)', year='ALL', attendance='ALL')
    
    rows = dataset.get('rows', [])
    att = [r for r in rows if r.get('status', '').upper() in ('PUBLIC', 'VIRTUAL', 'PUBLIC_ATTENDED', 'ATTENDED')]
    
    excel_bytes = export_excel_from_dataset(dataset)
    
    os.makedirs("reports", exist_ok=True)
    out_path = "reports/Nandha_Engineering_College_Weekly_Contest_516_CSE_IOT_All_Years.xlsx"
    with open(out_path, "wb") as f:
        f.write(excel_bytes)
    
    print(f"SUCCESS: Generated {out_path} ({len(excel_bytes):,} bytes)")
    print(f"Total Cohort Rows: {len(rows)}")
    print(f"Public Solvers:    {len(att)}")
    print(f"Not Attended:      {len(rows) - len(att)}")

if __name__ == "__main__":
    generate_iot_all_years_excel()
