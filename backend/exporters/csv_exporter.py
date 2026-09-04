import csv
import io

def export_csv_from_dataset(dataset: dict) -> bytes:
    """
    CSV EXPORTER
    Generates exact CSV file directly from normalized ReportDataset.
    Guarantees exact row count and value equality with Preview.
    """
    output = io.StringIO()
    writer = csv.writer(output)

    contest_rows = dataset.get("rows") or []
    all_students = dataset.get("allStudents") or dataset.get("topStudents") or []
    participations = dataset.get("participations") or []

    if contest_rows:
        writer.writerow([
            "S.No", "Register No", "Student Name", "Dept", "Year",
            "Status", "Contest Name", "Q1", "Q2", "Q3", "Q4", "Contest Solved", "Rank"
        ])
        for idx, r in enumerate(contest_rows, start=1):
            writer.writerow([
                idx,
                r.get("reg_no", ""),
                r.get("name", ""),
                r.get("dept", ""),
                r.get("year", ""),
                r.get("status", "NOT ATTENDED"),
                r.get("contest_name", dataset.get("contestName", "")),
                r.get("q1", "—"),
                r.get("q2", "—"),
                r.get("q3", "—"),
                r.get("q4", "—"),
                r.get("total_solved", "—"),
                r.get("rank", "—")
            ])
    elif participations and not all_students:
        writer.writerow([
            "S.No", "Contest Name", "Date", "Register No", "Student Name",
            "Department", "Year", "Problems Solved", "Total Problems", "Contest Rank"
        ])
        for idx, p in enumerate(participations, start=1):
            writer.writerow([
                idx,
                p.get("contest_name", ""),
                p.get("date", ""),
                p.get("reg_no", ""),
                p.get("student_name", ""),
                p.get("dept", ""),
                p.get("year", ""),
                p.get("problems_solved", 0),
                p.get("total_problems", 4),
                p.get("rank", "-")
            ])
    else:
        writer.writerow([
            "S.No", "Register No", "Student Name", "Department", "Batch", "Year",
            "Institutional Email", "LeetCode Profile Link", "Username", "Easy Solved", "Medium Solved",
            "Hard Solved", "Total Solved", "Contest Rating", "Global Rank", "Status"
        ])
        for idx, s in enumerate(all_students, start=1):
            writer.writerow([
                idx,
                s.get("reg_no", ""),
                s.get("name", ""),
                s.get("dept", ""),
                s.get("batch", ""),
                s.get("year", ""),
                s.get("institutional_email", ""),
                s.get("leetcode_url") or s.get("url") or "",
                s.get("username", ""),
                s.get("easy") if s.get("easy") is not None else "",
                s.get("medium") if s.get("medium") is not None else "",
                s.get("hard") if s.get("hard") is not None else "",
                s.get("total_solved") if s.get("total_solved") is not None else "",
                s.get("rating") if s.get("rating") is not None else "",
                s.get("global_rank") if s.get("global_rank") is not None else "",
                s.get("status", "UNVERIFIED")
            ])

    return output.getvalue().encode('utf-8-sig') # UTF-8 BOM for Excel compatibility
