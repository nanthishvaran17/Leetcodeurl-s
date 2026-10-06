import csv
import io

def _fmt_acc(val):
    if val is None or str(val).strip() in ("—", "None", "nan", "NaN", "null", ""):
        return "—"
    s = str(val).strip()
    u = s.upper()
    if "DAY" in u or u == "D":
        return "Day Scholar"
    if "HOSTEL" in u or u == "H":
        return "Hosteller"
    return s

def _fmt_cutoff(val):
    if val is None or str(val).strip() in ("—", "None", "nan", "NaN", "null", ""):
        return "—"
    try:
        f = float(val)
        return f"{f:.1f}" if f > 0 else "—"
    except (ValueError, TypeError):
        return str(val).strip()

def export_csv_from_dataset(dataset: dict) -> bytes:
    """
    CSV EXPORTER
    Generates exact CSV file directly from normalized ReportDataset.
    Guarantees exact row count and value equality with Preview, including Accommodation and 12th Cutoff.
    """
    output = io.StringIO()
    writer = csv.writer(output)

    contest_rows = dataset.get("rows") or dataset.get("all_students_current") or dataset.get("allStudents") or []
    all_students = dataset.get("allStudents") or dataset.get("all_students_current") or dataset.get("topStudents") or dataset.get("rows") or []
    participations = dataset.get("participations") or []

    # Check if this dataset is actually a specific contest session with question breakdown
    has_contest_questions = any(
        r.get("q1") is not None and str(r.get("q1")).strip() not in ("—", "")
        for r in contest_rows[:25]
    ) if contest_rows else False

    if contest_rows and has_contest_questions:
        writer.writerow([
            "S.No", "Register No", "Student Name", "Dept", "Year", "Accommodation", "12th Cutoff", "Contests Attended",
            "Status", "Contest Name", "Q1", "Q2", "Q3", "Q4", "Total Solved", "Contest Easy", "Contest Medium", "Contest Hard", "Global Rank", "Contest Rating"
        ])
        for idx, r in enumerate(contest_rows, start=1):
            writer.writerow([
                idx,
                r.get("reg_no", ""),
                r.get("name", ""),
                r.get("dept", r.get("department", "")),
                r.get("year", r.get("year_level", "")),
                _fmt_acc(r.get("accommodation") or r.get("accomodation") or r.get("accommodation_type")),
                _fmt_cutoff(r.get("twelfth_cutoff") if r.get("twelfth_cutoff") is not None else (r.get("cutoff") if r.get("cutoff") is not None else r.get("twelfthCutoff"))),
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
        rows_to_export = all_students or contest_rows
        for idx, s in enumerate(rows_to_export, start=1):
            writer.writerow([
                idx,
                s.get("reg_no", ""),
                s.get("name", ""),
                s.get("dept", s.get("department", "")),
                s.get("year", s.get("year_level", "")),
                _fmt_acc(s.get("accommodation") or s.get("accomodation") or s.get("accommodation_type")),
                _fmt_cutoff(s.get("twelfth_cutoff") if s.get("twelfth_cutoff") is not None else (s.get("cutoff") if s.get("cutoff") is not None else s.get("twelfthCutoff"))),
                s.get("contests_attended", s.get("total_attended", 0)),
                s.get("total_solved") if s.get("total_solved") is not None else (s.get("totalSolved", "")),
                s.get("contest_easy", 0),
                s.get("contest_medium", 0),
                s.get("contest_hard", 0),
                s.get("easy") if s.get("easy") is not None else (s.get("easy_solved", "")),
                s.get("medium") if s.get("medium") is not None else (s.get("medium_solved", "")),
                s.get("hard") if s.get("hard") is not None else (s.get("hard_solved", "")),
                s.get("global_rank") if s.get("global_rank") is not None else (s.get("rank") or s.get("profile_rank") or ""),
                s.get("contest_rating") or s.get("rating") or "",
                s.get("status") or s.get("verification_status") or "UNVERIFIED"
            ])

    return output.getvalue().encode('utf-8-sig') # UTF-8 BOM for Excel compatibility
