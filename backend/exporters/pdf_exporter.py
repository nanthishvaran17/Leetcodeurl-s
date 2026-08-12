import os
import io
import datetime
import re
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, HRFlowable
from reportlab.lib.units import inch

def export_pdf_from_dataset(dataset: dict) -> bytes:
    """
    PDF EXPORTER
    Generates high-resolution printable PDF directly from normalized ReportDataset.
    Uses Times New Roman font ONLY.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    story = []
    styles = getSampleStyleSheet()

    # Custom styles - Times New Roman font ONLY
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Times-Bold',
        fontSize=15,
        leading=18,
        textColor=colors.HexColor('#0F172A'),
        alignment=1
    )

    sub_style = ParagraphStyle(
        'DocSubTitle',
        parent=styles['Normal'],
        fontName='Times-Bold',
        fontSize=11,
        leading=14,
        textColor=colors.HexColor('#0284C7'),
        alignment=1
    )

    meta_style = ParagraphStyle(
        'DocMeta',
        parent=styles['Normal'],
        fontName='Times-Roman',
        fontSize=8.5,
        textColor=colors.HexColor('#64748B'),
        alignment=1
    )

    header_cell_style = ParagraphStyle(
        'HCell', fontName='Times-Bold', fontSize=8.5, textColor=colors.white, alignment=1
    )
    cell_style = ParagraphStyle(
        'NCell', fontName='Times-Roman', fontSize=8, leading=10, textColor=colors.HexColor('#334155')
    )
    cell_bold_style = ParagraphStyle(
        'BCell', fontName='Times-Bold', fontSize=8, leading=10, textColor=colors.HexColor('#0F172A'), alignment=1
    )

    # 1. Header Banner
    logo_path = os.path.join(os.path.dirname(__file__), "..", "assets", "nandha_emblem.png")
    header_text_elements = [
        Paragraph("NANDHA ENGINEERING COLLEGE (AUTONOMOUS)", title_style),
        Spacer(1, 2),
        Paragraph("Approved by AICTE, New Delhi & Affiliated to Anna University, Chennai | Erode - 638 052", meta_style),
        Spacer(1, 3),
        Paragraph(dataset.get("title", "Student Performance Report"), sub_style),
        Spacer(1, 2),
        Paragraph(f"Report ID: {dataset.get('reportId', '')} | Generated: {dataset.get('generatedAt', '')[:10]} | Status: {dataset.get('dataStatus', 'READY')}", meta_style)
    ]

    if os.path.exists(logo_path):
        try:
            img = Image(logo_path, width=1.2*inch, height=0.85*inch)
            header_table = Table([[img, header_text_elements]], colWidths=[1.3*inch, 5.7*inch])
            header_table.setStyle(TableStyle([
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('ALIGN', (0, 0), (0, 0), 'LEFT'),
                ('ALIGN', (1, 0), (1, 0), 'CENTER'),
            ]))
            story.append(header_table)
        except Exception:
            for el in header_text_elements: story.append(el)
    else:
        for el in header_text_elements: story.append(el)

    story.append(Spacer(1, 6))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#0284C7'), spaceAfter=10))

    # 2. Executive Summary Metrics
    metrics = dataset.get("metrics", {})
    if metrics:
        story.append(Paragraph("<b>Executive Summary Metrics</b>", ParagraphStyle('H2', fontName='Times-Bold', fontSize=10, textColor=colors.HexColor('#0F172A'))))
        story.append(Spacer(1, 4))
        
        m_items = list(metrics.items())
        m_rows = []
        for i in range(0, len(m_items), 2):
            k1, v1 = m_items[i]
            val1 = f"{v1:,}" if isinstance(v1, (int, float)) and v1 > 999 else str(v1 if v1 is not None else "—")
            row = [Paragraph(re.sub(r'([A-Z])', r' \1', str(k1)).strip().title(), cell_bold_style), Paragraph(val1, cell_style)]
            if i + 1 < len(m_items):
                k2, v2 = m_items[i+1]
                val2 = f"{v2:,}" if isinstance(v2, (int, float)) and v2 > 999 else str(v2 if v2 is not None else "—")
                row.extend([Paragraph(re.sub(r'([A-Z])', r' \1', str(k2)).strip().title(), cell_bold_style), Paragraph(val2, cell_style)])
            else:
                row.extend([Paragraph("", cell_style), Paragraph("", cell_style)])
            m_rows.append(row)

        t_m = Table(m_rows, colWidths=[1.8*inch, 1.7*inch, 1.8*inch, 1.7*inch])
        t_m.setStyle(TableStyle([
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F8FAFC')),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('TOPPADDING', (0,0), (-1,-1), 3.5),
            ('BOTTOMPADDING', (0,0), (-1,-1), 3.5),
        ]))
        story.append(t_m)
        story.append(Spacer(1, 10))

    # 3. Category Distribution
    distribution = dataset.get("distribution")
    if distribution:
        story.append(Paragraph("<b>Problem Solving Category Summary</b>", ParagraphStyle('H2', fontName='Times-Bold', fontSize=10, textColor=colors.HexColor('#0F172A'))))
        story.append(Spacer(1, 4))
        d_rows = [[Paragraph("Category Range", header_cell_style), Paragraph("Student Count", header_cell_style)]]
        for cat, count in distribution.items():
            d_rows.append([Paragraph(str(cat), cell_style), Paragraph(str(count), cell_bold_style)])
        t_d = Table(d_rows, colWidths=[4.0*inch, 3.0*inch])
        t_d.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0F172A')),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
            ('TOPPADDING', (0,0), (-1,-1), 3),
            ('BOTTOMPADDING', (0,0), (-1,-1), 3),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#F8FAFC')])
        ]))
        story.append(t_d)
        story.append(Spacer(1, 10))

    # 4. Top Performers Leaderboard
    top_students = dataset.get("topStudents")
    if top_students:
        story.append(Paragraph("<b>Top Performers Leaderboard</b>", ParagraphStyle('H2', fontName='Times-Bold', fontSize=10, textColor=colors.HexColor('#0F172A'))))
        story.append(Spacer(1, 4))
        top_rows = [[
            Paragraph("Rank", header_cell_style),
            Paragraph("Reg No", header_cell_style),
            Paragraph("Name", header_cell_style),
            Paragraph("Dept", header_cell_style),
            Paragraph("Year", header_cell_style),
            Paragraph("Solved", header_cell_style),
            Paragraph("Rating", header_cell_style)
        ]]
        for idx, s in enumerate(top_students, 1):
            top_rows.append([
                Paragraph(f"#{idx}", cell_bold_style),
                Paragraph(s.get("reg_no", ""), cell_style),
                Paragraph(s.get("name", ""), cell_style),
                Paragraph(s.get("dept", ""), cell_style),
                Paragraph(s.get("year", ""), cell_style),
                Paragraph(str(s.get("total_solved", 0)), cell_bold_style),
                Paragraph(str(round(s["rating"], 1)) if s.get("rating") else "—", cell_style)
            ])
        t_top = Table(top_rows, colWidths=[0.5*inch, 1.2*inch, 2.3*inch, 0.9*inch, 0.6*inch, 0.7*inch, 0.8*inch])
        t_top.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0F172A')),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
            ('TOPPADDING', (0,0), (-1,-1), 3),
            ('BOTTOMPADDING', (0,0), (-1,-1), 3),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#F8FAFC')])
        ]))
        story.append(t_top)
        story.append(Spacer(1, 10))

    # 5. Full Roster Table
    all_students = dataset.get("allStudents")
    if all_students:
        story.append(Paragraph(f"<b>Student Performance Roster ({len(all_students)} Students)</b>", ParagraphStyle('H2', fontName='Times-Bold', fontSize=10, textColor=colors.HexColor('#0F172A'))))
        story.append(Spacer(1, 4))
        all_rows = [[
            Paragraph("S.No", header_cell_style),
            Paragraph("Reg No", header_cell_style),
            Paragraph("Name", header_cell_style),
            Paragraph("Dept", header_cell_style),
            Paragraph("Year", header_cell_style),
            Paragraph("Solved", header_cell_style),
            Paragraph("Status", header_cell_style)
        ]]
        for idx, s in enumerate(all_students[:150], 1): # Support multi-page print
            all_rows.append([
                Paragraph(str(idx), cell_style),
                Paragraph(s.get("reg_no", ""), cell_style),
                Paragraph(s.get("name", ""), cell_style),
                Paragraph(s.get("dept", ""), cell_style),
                Paragraph(s.get("year", ""), cell_style),
                Paragraph(str(s.get("total_solved") if s.get("total_solved") is not None else "—"), cell_bold_style),
                Paragraph(s.get("status", "UNVERIFIED"), cell_style)
            ])
        t_all = Table(all_rows, colWidths=[0.5*inch, 1.3*inch, 2.3*inch, 0.8*inch, 0.6*inch, 0.7*inch, 0.8*inch])
        t_all.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0F172A')),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
            ('TOPPADDING', (0,0), (-1,-1), 2.5),
            ('BOTTOMPADDING', (0,0), (-1,-1), 2.5),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#F8FAFC')])
        ]))
        story.append(t_all)
        story.append(Spacer(1, 10))

    # 6. Contest Participations
    participations = dataset.get("participations")
    if participations:
        story.append(Paragraph("<b>Official Contest Participation Log</b>", ParagraphStyle('H2', fontName='Times-Bold', fontSize=10, textColor=colors.HexColor('#0F172A'))))
        story.append(Spacer(1, 4))
        p_rows = [[
            Paragraph("S.No", header_cell_style),
            Paragraph("Contest", header_cell_style),
            Paragraph("Date", header_cell_style),
            Paragraph("Reg No", header_cell_style),
            Paragraph("Name", header_cell_style),
            Paragraph("Dept", header_cell_style),
            Paragraph("Solved", header_cell_style),
            Paragraph("Rank", header_cell_style)
        ]]
        for idx, p in enumerate(participations, 1):
            p_rows.append([
                Paragraph(str(idx), cell_style),
                Paragraph(p.get("contest_name", ""), cell_style),
                Paragraph(p.get("date", ""), cell_style),
                Paragraph(p.get("reg_no", ""), cell_style),
                Paragraph(p.get("student_name", ""), cell_style),
                Paragraph(p.get("dept", ""), cell_style),
                Paragraph(f"{p.get('problems_solved', 0)} / {p.get('total_problems', 4)}", cell_bold_style),
                Paragraph(str(p.get("rank", "-")), cell_style)
            ])
        t_p = Table(p_rows, colWidths=[0.4*inch, 1.5*inch, 0.8*inch, 1.1*inch, 1.5*inch, 0.6*inch, 0.6*inch, 0.5*inch])
        t_p.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0F172A')),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
            ('TOPPADDING', (0,0), (-1,-1), 3),
            ('BOTTOMPADDING', (0,0), (-1,-1), 3),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#F8FAFC')])
        ]))
        story.append(t_p)

    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
