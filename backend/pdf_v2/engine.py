import io
from typing import Dict, Any
from reportlab.lib.pagesizes import landscape, A4
from reportlab.platypus import SimpleDocTemplate, PageBreak, Spacer, Paragraph

from backend.pdf_v2.styles import get_report_styles, get_base_table_style
from backend.pdf_v2.sections.header_and_executive import build_header, build_executive_dashboard
from backend.pdf_v2.sections.department_and_year import build_department_intelligence, build_year_intelligence
from backend.pdf_v2.sections.dsa_and_language import build_dsa_intelligence, build_language_intelligence
from backend.pdf_v2.sections.student_deep_dive import build_student_comparison

def build_intelligence_pdf(dataset: Dict[str, Any]) -> bytes:
    """
    Master PDF Orchestrator.
    Takes the massive canonical dataset and stitches the sections together.
    """
    buffer = io.BytesIO()
    
    doc = SimpleDocTemplate(
        buffer,
        pagesize=landscape(A4),
        rightMargin=20,
        leftMargin=20,
        topMargin=20,
        bottomMargin=20,
        title="Friday Weekly LeetCode Intelligence Report",
        author="Nandha Intelligence Platform"
    )

    story = []
    styles = get_report_styles()
    table_style = get_base_table_style()

    # SECTION 1 & 2
    story.extend(build_header(dataset, styles))
    story.extend(build_executive_dashboard(dataset, styles, table_style))
    story.append(PageBreak())

    # SECTION 3 & 4
    story.extend(build_department_intelligence(dataset, styles, table_style))
    story.extend(build_year_intelligence(dataset, styles, table_style))
    story.append(PageBreak())

    # SECTION 5 & 6
    story.extend(build_dsa_intelligence(dataset, styles, table_style))
    story.extend(build_language_intelligence(dataset, styles, table_style))
    story.append(PageBreak())

    # SECTION 8 (Comparison)
    story.extend(build_student_comparison(dataset, styles, table_style))

    doc.build(story)
    
    return buffer.getvalue()
