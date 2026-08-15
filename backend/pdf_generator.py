import io
import os
import datetime
from typing import Dict, Any, List
from reportlab.lib.pagesizes import letter, landscape, A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.units import inch

def generate_pdf_report(db, dept_id: int = None, *args, **kwargs) -> bytes:
    """
    Generates an official landscape PDF performance report for Nandha Engineering College.
    """
    from backend.word_generator import _compute_dept_matrix, BATCH_CONFIG

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
        fontSize=13,
        leading=16,
        alignment=1,
        textColor=colors.HexColor("#0f172a")
    )
    dept_style = ParagraphStyle(
        'DeptTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=14,
        alignment=1,
        textColor=colors.HexColor("#1e293b")
    )
    sub_style = ParagraphStyle(
        'SubTitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        alignment=1,
        textColor=colors.HexColor("#475569")
    )
    cell_style = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.5,
        leading=9,
        alignment=1
    )
    cell_bold = ParagraphStyle(
        'TableCellBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=7.5,
        leading=9,
        alignment=1
    )

    story = []

    departments = [
        (1, "Department of Computer Science and Engineering (Cyber Security)"),
        (2, "Department of Computer Science and Engineering (IoT)")
    ]
    if dept_id:
        departments = [d for d in departments if d[0] == dept_id]

    for d_idx, (did, dept_name) in enumerate(departments):
        if d_idx > 0:
            story.append(PageBreak())

        # Header
        story.append(Paragraph("NANDHA ENGINEERING COLLEGE, ERODE - 638 052.", title_style))
        story.append(Paragraph("(An Autonomous Institution, Affiliated to Anna University, Chennai)", sub_style))
        story.append(Spacer(1, 4))
        story.append(Paragraph(dept_name, dept_style))
        story.append(Spacer(1, 4))
        story.append(Paragraph(f"<b>Date:</b> {datetime.datetime.now().strftime('%d.%m.%Y')} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <b>Leetcode Performance — Weekly Report</b>", sub_style))
        story.append(Paragraph("<b>Name & Designation of the Academic Coordinator:</b> M. Santhoshkumar, AP / CSE (Cyber Security)", sub_style))
        story.append(Spacer(1, 10))

        # Matrix Data
        data_cs = _compute_dept_matrix(db, did)

        # Table data
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

        for b_key in ["2023_2027", "2024_2028", "2025_2029"]:
            b_info = BATCH_CONFIG[b_key]
            b_label = b_info["label"]
            lw = data_cs[b_key]["last_week"]
            cw = data_cs[b_key]["current_week"]

            row_lw = [
                Paragraph(f"<b>{b_label}</b>\n(Last Week)", cell_style),
                Paragraph(str(lw["total_students"]), cell_bold),
                Paragraph(str(lw["prob_above_500"]), cell_style),
                Paragraph(str(lw["prob_250_500"]), cell_style),
                Paragraph(str(lw["prob_100_249"]), cell_style),
                Paragraph(str(lw["prob_1_99"]), cell_style),
                Paragraph(str(lw["prob_0"]), cell_style),
                Paragraph(str(lw["q4"]), cell_style),
                Paragraph(str(lw["q3"]), cell_style),
                Paragraph(str(lw["q2"]), cell_style),
                Paragraph(str(lw["q1"]), cell_style),
                Paragraph(str(lw["rating_above_1500"]), cell_style),
                Paragraph(str(lw["rank_below_20k"]), cell_style)
            ]
            row_cw = [
                Paragraph(f"<b>{b_label}</b>\n(Current Week)", cell_style),
                Paragraph(str(cw["total_students"]), cell_bold),
                Paragraph(str(cw["prob_above_500"]), cell_style),
                Paragraph(str(cw["prob_250_500"]), cell_style),
                Paragraph(str(cw["prob_100_249"]), cell_style),
                Paragraph(str(cw["prob_1_99"]), cell_style),
                Paragraph(str(cw["prob_0"]), cell_style),
                Paragraph(str(cw["q4"]), cell_style),
                Paragraph(str(cw["q3"]), cell_style),
                Paragraph(str(cw["q2"]), cell_style),
                Paragraph(str(cw["q1"]), cell_style),
                Paragraph(str(cw["rating_above_1500"]), cell_style),
                Paragraph(str(cw["rank_below_20k"]), cell_style)
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
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ('LEFTPADDING', (0, 0), (-1, -1), 2),
            ('RIGHTPADDING', (0, 0), (-1, -1), 2),
        ]))
        story.append(t)
        story.append(Spacer(1, 20))
        story.append(Paragraph("<b>Verified Signatures:</b> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <b>Academic Coordinator</b> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <b>Head of Department</b>", sub_style))

    doc.build(story)
    return buffer.getvalue()

generate_pdf_summary_report = generate_pdf_report
generate_weekly_pdf_report = generate_pdf_report
generate_snapshot_pdf_report = generate_pdf_report
