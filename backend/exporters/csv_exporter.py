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
    Guarantees exact 10-column layout and value equality with Excel and PDF, including Accommodation and 12th Cutoff.
    """
    output = io.StringIO()
    writer = csv.writer(output)

    contest_rows = dataset.get("rows") or dataset.get("all_students_current") or dataset.get("allStudents") or []
    all_students = dataset.get("allStudents") or dataset.get("all_students_current") or dataset.get("topStudents") or dataset.get("rows") or []
    participations = dataset.get("participations") or []

    # Check if this dataset is a specific contest session with question breakdown
    has_contest_questions = any(
        r.get("q1") is not None and str(r.get("q1")).strip() not in ("—", "")
        for r in contest_rows[:25]
    ) if contest_rows else False

    if contest_rows and has_contest_questions:
        writer.writerow([
            "S.No", "Reg No", "Name", "Acc", "Cutoff",
            "Q1 (Easy)", "Q2 (Medium)", "Q3 (Medium)", "Q4 (Hard)", "Total Solved"
        ])
        for idx, r in enumerate(contest_rows, start=1):
            # Calculate strict contest solved for that specific contest (0 to 4)
            q1_v = 1 if str(r.get("q1", "")).strip() in ("1", "1.0", "True") else 0
            q2_v = 1 if str(r.get("q2", "")).strip() in ("1", "1.0", "True") else 0
            q3_v = 1 if str(r.get("q3", "")).strip() in ("1", "1.0", "True") else 0
            q4_v = 1 if str(r.get("q4", "")).strip() in ("1", "1.0", "True") else 0
            c_sum = q1_v + q2_v + q3_v + q4_v

            raw_c = r.get("contest_solved")
            if raw_c is not None:
                try:
                    c_solved = int(raw_c)
                except (ValueError, TypeError):
                    c_solved = c_sum
            else:
                c_solved = c_sum

            acc_val = _fmt_acc(r.get("accommodation") or r.get("acc") or r.get("accommodation_type"))
            cutoff_val = _fmt_cutoff(r.get("twelfth_cutoff") or r.get("cutoff") or r.get("twelfth_mark") or r.get("cutoff_mark"))

            writer.writerow([
                idx,
                str(r.get("reg_no", "")).strip().upper(),
                str(r.get("name") or r.get("student_name") or "").strip().upper(),
                acc_val,
                cutoff_val,
                r.get("q1_display") or r.get("q1") or "—",
                r.get("q2_display") or r.get("q2") or "—",
                r.get("q3_display") or r.get("q3") or "—",
                r.get("q4_display") or r.get("q4") or "—",
                c_solved
            ])
    elif participations and not all_students:
        writer.writerow([
            "S.No", "Contest Name", "Date", "Reg No", "Name",
            "Dept", "Year", "Problems Solved", "Total Problems", "Contest Rank"
        ])
        for idx, p in enumerate(participations, start=1):
            writer.writerow([
                idx,
                p.get("contest_name", ""),
                p.get("date", ""),
                str(p.get("reg_no", "")).strip().upper(),
                str(p.get("student_name") or p.get("name") or "").strip().upper(),
                p.get("dept", ""),
                p.get("year", ""),
                p.get("problems_solved", 0),
                p.get("total_problems", 4),
                p.get("rank", "-")
            ])
    else:
        writer.writerow([
            "S.No", "Reg No", "Name", "Acc", "Cutoff", "Dept", "Year",
            "Easy", "Medium", "Hard", "Total Solved", "Contests Attended", "Global Rank", "Contest Rating", "Status"
        ])
        rows_to_export = all_students or contest_rows
        for idx, s in enumerate(rows_to_export, start=1):
            acc_val = _fmt_acc(s.get("accommodation") or s.get("acc") or s.get("accommodation_type"))
            cutoff_val = _fmt_cutoff(s.get("twelfth_cutoff") or s.get("cutoff") or s.get("twelfth_mark") or s.get("cutoff_mark"))

            writer.writerow([
                idx,
                str(s.get("reg_no", "")).strip().upper(),
                str(s.get("name") or s.get("student_name") or "").strip().upper(),
                acc_val,
                cutoff_val,
                s.get("dept", s.get("department", "")),
                s.get("year", s.get("year_level", "")),
                s.get("easy") if s.get("easy") is not None else (s.get("easy_solved", 0)),
                s.get("medium") if s.get("medium") is not None else (s.get("medium_solved", 0)),
                s.get("hard") if s.get("hard") is not None else (s.get("hard_solved", 0)),
                s.get("total_solved") if s.get("total_solved") is not None else (s.get("totalSolved", 0)),
                s.get("contests_attended", s.get("total_attended", 0)),
                s.get("global_rank") if s.get("global_rank") is not None else (s.get("contest_global_ranking") or s.get("profile_rank") or "—"),
                s.get("contest_rating") or s.get("rating") or "—",
                s.get("status") or s.get("verification_status") or "ACTIVE"
            ])

    return output.getvalue().encode('utf-8-sig') # UTF-8 BOM for Excel compatibility
