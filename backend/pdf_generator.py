"""
Master PDF Report Generator
Routes all PDF export calls directly to the high-fidelity Intelligence PDF Engine (pdf_v2).
"""
import io
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session

from backend.pdf_v2.engine import build_intelligence_pdf
from backend.services.intelligence_report_service import build_intelligence_dataset


def generate_pdf_report(
    db: Session, 
    dept_id: Optional[int] = None, 
    department: Optional[str] = None,
    year: Optional[str] = None,
    current_user: Optional[Any] = None,
    *args, 
    **kwargs
) -> bytes:
    """
    Builds the official landscape Friday Weekly LeetCode Intelligence Report PDF.
    Grounded 100% in real database metrics.
    """
    eff_user = current_user or kwargs.get('current_user')
    eff_dept = department or kwargs.get('department')
    eff_year = year or kwargs.get('year')

    if dept_id and not eff_dept:
        from backend.models import Department
        d_obj = db.query(Department).filter(Department.id == dept_id).first()
        if d_obj:
            eff_dept = d_obj.code or d_obj.name

    # 1. Generate canonical validated dataset
    dataset = build_intelligence_dataset(
        db=db, 
        department=eff_dept, 
        year=eff_year, 
        current_user=eff_user
    )
    
    # 2. Build the high-density digital PDF
    pdf_bytes = build_intelligence_pdf(dataset)
    
    return pdf_bytes


generate_pdf_summary_report = generate_pdf_report
generate_weekly_pdf_report = generate_pdf_report
generate_snapshot_pdf_report = generate_pdf_report
