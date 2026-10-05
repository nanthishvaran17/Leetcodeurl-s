import csv
import io

def _fmt_acc(val):
    if not val or str(val).strip() in ("—", "None", "nan", "NaN", "null", ""):
        return "—"
    s = str(val).strip().upper()
    if "DAY" in s:
        return "D"
    if "HOSTEL" in s:
        return "H"
    return s[:1]

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
            "S.No", "Register No", "Student Name", "Dept", "Year", "Accommodation", "12th Cutoff", "Contests Attended",
            "Status", "Contest Name", "Q1", "Q2", "Q3", "Q4", "Total Solved", "Contest Easy", "Contest Medium", "Contest Hard", "Global Rank", "Contest Rating"
        ])
        for idx, r in enumerate(contest_rows, start=1):
            writer.writerow([
                idx,
                r.get("reg_no", ""),
                r.get("name", ""),
                r.get("dept", ""),
                r.get("year", ""),
                _fmt_acc(r.get("accommodation")),
                r.get("twelfth_cutoff") if r.get("twelfth_cutoff") is not None else (r.get("cutoff") if r.get("cutoff") is not None else "—"),
                r.get("contests_attended", r.get("total_attended", 0)),
                r.get("status", "NOT ATTENDED"),
                r.get("contest_name", dataset.get("contestName", "")),
                r.get("q1", "—"),
                r.get("q2", "—"),
                r.get("q3", "—"),
                r.get("q4", "—"),
                r.get("total_solved") if r.get("total_solved") is not None else (r.get("contest_solved", "—")),
                r.get("contest_easy", 0),
                r.get("contest_medium", 0),
                r.get("contest_hard", 0),
                r.get("global_rank") or r.get("rank") or "—",
                r.get("contest_rating") or r.get("rating") or "—"
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
            "S.No", "Register No", "Student Name", "Department", "Year", "Accommodation", "12th Cutoff", "Contests Attended",
            "Total Solved", "Contest Easy", "Contest Medium", "Contest Hard",
            "Easy Solved", "Medium Solved", "Hard Solved", "Global Rank", "Contest Rating", "Status"
        ])
        for idx, s in enumerate(all_students, start=1):
            writer.writerow([
                idx,
                s.get("reg_no", ""),
                s.get("name", ""),
                s.get("dept", ""),
                s.get("year", ""),
                _fmt_acc(s.get("accommodation")),
                s.get("twelfth_cutoff") if s.get("twelfth_cutoff") is not None else (s.get("cutoff") if s.get("cutoff") is not None else "—"),
                s.get("contests_attended", s.get("total_attended", 0)),
                s.get("total_solved") if s.get("total_solved") is not None else "",
                s.get("contest_easy", 0),
                s.get("contest_medium", 0),
                s.get("contest_hard", 0),
                s.get("easy") if s.get("easy") is not None else "",
                s.get("medium") if s.get("medium") is not None else "",
                s.get("hard") if s.get("hard") is not None else "",
                s.get("global_rank") if s.get("global_rank") is not None else "",
                s.get("contest_rating") or s.get("rating") or "",
                s.get("status", "UNVERIFIED")
            ])

    return output.getvalue().encode('utf-8-sig') # UTF-8 BOM for Excel compatibility
