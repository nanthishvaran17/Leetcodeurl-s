"""
Master PDF Report Generator
Routes all PDF export calls directly to the high-fidelity Intelligence PDF Engine (pdf_v2).
Always generates fresh from live DB — no cache, so every download reflects the latest sync.
"""
from typing import Any, Optional, Union

from backend.pdf_v2.engine import build_intelligence_pdf
from backend.services.intelligence_report_service import build_intelligence_dataset


def generate_pdf_report(
    db: Any,
    dept_id: Optional[Union[int, str]] = None,
    department: Optional[str] = None,
    year: Optional[str] = None,
    current_user: Optional[Any] = None,
    *args,
    **kwargs
) -> bytes:
    """
    Builds the official landscape Friday Weekly LeetCode Intelligence Report PDF.
    Always queries live DB — no caching, so every click reflects the latest data sync.
    """
    # Accept pre-built dataset dict (e.g. from scheduled jobs)
    if isinstance(db, dict):
        return build_intelligence_pdf(db)

    eff_user = current_user or kwargs.get('current_user')
    eff_dept = department or kwargs.get('department') or "ALL"
    eff_year = year or kwargs.get('year') or "ALL"

    if dept_id and (not eff_dept or eff_dept == "ALL"):
        from backend.models import Department
        d_obj = db.query(Department).filter(Department.id == dept_id).first()
        if d_obj:
            eff_dept = d_obj.code or d_obj.name

    # Always build fresh dataset from live DB
    dataset = build_intelligence_dataset(
        db=db,
        department=eff_dept if eff_dept != "ALL" else None,
        year=eff_year if eff_year != "ALL" else None,
        current_user=eff_user
    )

    return build_intelligence_pdf(dataset)


generate_pdf_summary_report = generate_pdf_report
generate_weekly_pdf_report = generate_pdf_report
generate_snapshot_pdf_report = generate_pdf_report
build_weekly_performance_pdf = generate_pdf_report
build_intelligence_pdf_bytes = generate_pdf_report

