"""
Master PDF Report Generator
Generates official landscape A4 PDF performance reports for Nandha Engineering College.
Consumes ONLY canonical dataset dictionary.
"""
import io
import datetime
from typing import Dict, Any, List, Optional
from reportlab.lib.pagesizes import landscape, A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak

from backend.config.report_config import BATCH_CONFIG, DEPARTMENT_COORDINATORS, get_coordinator_for_department


def build_weekly_performance_pdf(data: Dict[str, Any], dept_id: Optional[int] = None) -> bytes:
    """
    Builds official landscape PDF performance report directly from the canonical dataset.
    Does NOT query database.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=landscape(A4),
        rightMargin=20,
        leftMargin=20,
        topMargin=20,
        bottomMargin=20
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=15,
        alignment=1,
        textColor=colors.HexColor("#0f172a")
    )
    dept_style = ParagraphStyle(
        'DeptTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10.5,
        leading=13,
        alignment=1,
        textColor=colors.HexColor("#1e293b")
    )
    sub_style = ParagraphStyle(
        'SubTitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=11,
        alignment=1,
        textColor=colors.HexColor("#334155")
    )
    cell_style = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7,
        leading=8.5,
        alignment=1
    )
    cell_bold = ParagraphStyle(
        'TableCellBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=7,
        leading=8.5,
        alignment=1
    )

    story = []
    report_date = data.get("report_date", datetime.date.today().strftime("%d.%m.%Y"))
    dept_summaries = data.get("dept_summaries", [])

    if dept_id is not None:
        dept_summaries = [d for d in dept_summaries if d.get("department_id") == dept_id]

    if not dept_summaries:
        # Fallback: create empty summary representation
        dept_summaries = [{
            "department_id": 1,
            "department": "CSE(CS)",
            "department_name": "Department of Computer Science and Engineering (Cyber Security)",
            "coordinator": DEPARTMENT_COORDINATORS.get("CSE(CS)"),
            "batches": {}
        }]

    for d_idx, dept in enumerate(dept_summaries):
        if d_idx > 0:
            story.append(PageBreak())

        dept_code = dept.get("department", "CSE")
        dept_name_display = dept.get("department_name") or f"Department of {dept_code}"
        coordinator = dept.get("coordinator") or get_coordinator_for_department(dept_code)

        # Header
        story.append(Paragraph("<b>NANDHA ENGINEERING COLLEGE, ERODE - 638 052.</b>", title_style))
        story.append(Paragraph("(An Autonomous Institution, Affiliated to Anna University, Chennai)", sub_style))
        story.append(Spacer(1, 4))
        story.append(Paragraph(f"<b>{dept_name_display}</b>", dept_style))
        story.append(Spacer(1, 4))
        story.append(Paragraph(
            f"<b>Date:</b> {report_date} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; "
            f"<b>LeetCode Performance — Weekly Report</b>", sub_style
        ))
        story.append(Paragraph(f"<b>Name & Designation of the Academic Coordinator:</b> {coordinator}", sub_style))
        story.append(Spacer(1, 8))

        # Table Headers
        header_row1 = [
            "Batch", "No. of Students\n(Total Count)",
            "Number of Problems Solved", "", "", "", "",
            "Weekly Contest Attended", "", "", "",
            "Leetcode Contest Rating and Ranking", ""
        ]
        header_row2 = [
            "", "",
            "Above\n500", "250 -\n500", "100 -\n249", "1 - 99", "0",
            "4Q", "3Q", "2Q", "1Q",
            "Rating\n> 1500", "Ranking\n< 20000"
        ]

        table_data = [
            [Paragraph(f"<b>{c}</b>", cell_bold) for c in header_row1],
            [Paragraph(f"<b>{c}</b>", cell_bold) for c in header_row2]
        ]

        batches_dict = dept.get("batches", {})
        for b_cfg in BATCH_CONFIG:
            b_key = b_cfg["key"]
            b_label = b_cfg["label"]
            b_metrics = batches_dict.get(b_key, {})
            lw = b_metrics.get("last_week", {})
            cw = b_metrics.get("current_week", {})
            tot_st = b_metrics.get("total_students", 0)
            if tot_st == 0:
                continue

            row_lw = [
                Paragraph(f"<b>{b_label}</b>\n(Last Week)", cell_style),
                Paragraph(str(tot_st), cell_bold),
                Paragraph(str(lw.get("prob_above_500", 0)), cell_style),
                Paragraph(str(lw.get("prob_250_500", 0)), cell_style),
                Paragraph(str(lw.get("prob_100_249", 0)), cell_style),
                Paragraph(str(lw.get("prob_1_99", 0)), cell_style),
                Paragraph(str(lw.get("prob_0", 0)), cell_style),
                Paragraph(str(lw.get("q4", 0)), cell_style),
                Paragraph(str(lw.get("q3", 0)), cell_style),
                Paragraph(str(lw.get("q2", 0)), cell_style),
                Paragraph(str(lw.get("q1", 0)), cell_style),
                Paragraph(str(lw.get("rating_above_1500", 0)), cell_style),
                Paragraph(str(lw.get("rank_below_20000", 0)), cell_style)
            ]
            row_cw = [
                Paragraph(f"<b>{b_label}</b>\n(Current Week)", cell_style),
                Paragraph(str(tot_st), cell_bold),
                Paragraph(str(cw.get("prob_above_500", 0)), cell_style),
                Paragraph(str(cw.get("prob_250_500", 0)), cell_style),
                Paragraph(str(cw.get("prob_100_249", 0)), cell_style),
                Paragraph(str(cw.get("prob_1_99", 0)), cell_style),
                Paragraph(str(cw.get("prob_0", 0)), cell_style),
                Paragraph(str(cw.get("q4", 0)), cell_style),
                Paragraph(str(cw.get("q3", 0)), cell_style),
                Paragraph(str(cw.get("q2", 0)), cell_style),
                Paragraph(str(cw.get("q1", 0)), cell_style),
                Paragraph(str(cw.get("rating_above_1500", 0)), cell_style),
                Paragraph(str(cw.get("rank_below_20000", 0)), cell_style)
            ]
            table_data.append(row_lw)
            table_data.append(row_cw)

        col_widths = [85, 60, 48, 48, 48, 45, 35, 38, 38, 38, 38, 55, 55]
        t = Table(table_data, colWidths=col_widths, repeatRows=2)
        t.setStyle(TableStyle([
            ('SPAN', (0, 0), (0, 1)),
            ('SPAN', (1, 0), (1, 1)),
            ('SPAN', (2, 0), (6, 0)),
            ('SPAN', (7, 0), (10, 0)),
            ('SPAN', (11, 0), (12, 0)),
            ('BACKGROUND', (0, 0), (-1, 1), colors.HexColor("#f1f5f9")),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#94a3b8")),
            ('TOPPADDING', (0, 0), (-1, -1), 2.5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5),
            ('LEFTPADDING', (0, 0), (-1, -1), 2),
            ('RIGHTPADDING', (0, 0), (-1, -1), 2),
        ]))
        story.append(t)
        story.append(Spacer(1, 18))
        story.append(Paragraph(
            "<b>Verified Signatures:</b> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; "
            "<b>Academic Coordinator</b> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; "
            "<b>Head of Department</b>", sub_style
        ))

    doc.build(story)
    return buffer.getvalue()


def generate_pdf_report(db, dept_id: Optional[int] = None, *args, **kwargs) -> bytes:
    """
    Legacy compatibility wrapper: queries canonical dataset and builds PDF.
    """
    from backend.services.weekly_report_service import generate_weekly_performance_data
    data = generate_weekly_performance_data(db)
    return build_weekly_performance_pdf(data, dept_id=dept_id)


generate_pdf_summary_report = generate_pdf_report
generate_weekly_pdf_report = generate_pdf_report
generate_snapshot_pdf_report = generate_pdf_report
