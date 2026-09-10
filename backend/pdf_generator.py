"""
Master PDF Report Generator
Re-routes legacy calls to the new Intelligence PDF Engine (pdf_v2).
"""
import io
from typing import Dict, Any, Optional

from backend.pdf_v2.engine import build_intelligence_pdf
from backend.services.intelligence_report_service import build_intelligence_dataset

def generate_pdf_report(db, dept_id: Optional[int] = None, *args, **kwargs) -> bytes:
    """
    Builds official landscape PDF performance report using the v2 Intelligence Engine.
    """
    current_user = kwargs.get('current_user')
    
    # 1. Generate massive canonical dataset
    dataset = build_intelligence_dataset(db, current_user=current_user)
    
    # 2. Build the PDF
    pdf_bytes = build_intelligence_pdf(dataset)
    
    return pdf_bytes

generate_pdf_summary_report = generate_pdf_report
generate_weekly_pdf_report = generate_pdf_report
generate_snapshot_pdf_report = generate_pdf_report
