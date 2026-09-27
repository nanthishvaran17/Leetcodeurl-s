import csv
import io

def export_dynamic_csv(dataset: dict) -> bytes:
    output = io.StringIO()
    writer = csv.writer(output)

    rows = dataset.get("rows") or dataset.get("allStudents") or []
    if not rows:
        writer.writerow(["No data available for this report."])
        return output.getvalue().encode('utf-8-sig')

    # Extract headers from the first row
    first_row = rows[0]
    headers = list(first_row.keys())
    
    # Format header strings
    clean_headers = [h.replace("_", " ").title() for h in headers]

    # Write headers
    writer.writerow(clean_headers)

    # Write data rows
    for r in rows:
        row_vals = []
        for h in headers:
            val = r.get(h)
            row_vals.append(str(val) if val is not None else "")
        writer.writerow(row_vals)

    return output.getvalue().encode('utf-8-sig')
