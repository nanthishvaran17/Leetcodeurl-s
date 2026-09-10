from reportlab.platypus import Paragraph, Spacer, Table, PageBreak
from reportlab.lib.styles import ParagraphStyle

def build_header(dataset, styles):
    """SECTION 1: Cover / Report Header"""
    story = []
    meta = dataset["metadata"]
    
    story.append(Paragraph("<b>NANDHA ENGINEERING COLLEGE</b>", styles['Title']))
    story.append(Paragraph("(An Autonomous Institution, Affiliated to Anna University, Chennai)", styles['SubTitle']))
    story.append(Spacer(1, 10))
    story.append(Paragraph(f"<b>FRIDAY WEEKLY LEETCODE INTELLIGENCE REPORT</b>", styles['SectionHeader']))
    story.append(Paragraph(f"Report Date: {meta['report_date']} | Generated At: {meta['generated_at']}", styles['NormalText']))
    story.append(Spacer(1, 20))
    return story

def build_executive_dashboard(dataset, styles, table_style):
    """SECTION 2: Executive Dashboard"""
    story = []
    summary = dataset["summary"]
    
    story.append(Paragraph("1. Executive Dashboard", styles['SectionHeader']))
    
    # Example Dashboard Table
    data = [
        ["Metric", "Value"],
        ["Total Active Students", str(summary["total_students"])],
        # To scale, we'd add total problems, total live participants, etc.
    ]
    
    t = Table(data, colWidths=[150, 100])
    t.setStyle(table_style)
    story.append(t)
    story.append(Spacer(1, 20))
    return story
