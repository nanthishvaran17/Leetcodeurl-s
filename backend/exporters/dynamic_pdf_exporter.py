import io
import os
import re
from datetime import datetime
from reportlab.lib import colors
from reportlab.lib.pagesizes import landscape, A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image, KeepInFrame
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        canvas.Canvas.__init__(self, *args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_number(num_pages)
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)

    def draw_page_number(self, page_count):
        self.saveState()
        self.setFont('Helvetica-Bold', 9)
        self.drawRightString(self._pagesize[0] - 30, 25, f"Page {self._pageNumber} of {page_count}")
        self.restoreState()

def export_dynamic_pdf(dataset: dict) -> bytes:
    output = io.BytesIO()
    
    rows = dataset.get("rows") or dataset.get("allStudents") or dataset.get("all_students_current") or []
    
    # Pre-calculate headers to determine dynamic page width
    clean_headers = []
    if rows:
        first_row = rows[0]
        weekly_data_keys = []
        if "weeklyData" in first_row:
            for wd in first_row.get("weeklyData", []):
                weekly_data_keys.append(wd.get("contestNum"))

        for h in first_row.keys():
            if h == "weeklyData":
                for c_num in weekly_data_keys:
                    clean_headers.append(f"C{c_num}")
            else:
                formatted_h = re.sub(r'([a-z])([A-Z])', r'\1 \2', h).replace("_", " ").title().replace('Pct', '%')
                clean_headers.append(formatted_h)
                
    num_cols = len(clean_headers)
    
    # Strict A4 dimensions as baseline
    base_width, doc_height = landscape(A4)
    margin = 25
    
    elements = []
    styles = getSampleStyleSheet()
    
    # Custom Page Decorator for Logo, Border, and Page Numbers
    def add_page_decorations(canvas, doc):
        canvas.saveState()
        
        # Use dynamic doc dimensions to ensure it works for fallback sizes too
        current_width, current_height = doc.pagesize
        
        # 1. Page Border
        canvas.setStrokeColor(colors.black)
        canvas.setLineWidth(1)
        canvas.rect(15, 15, current_width - 30, current_height - 30)
        
        # 2. Page Number is handled by NumberedCanvas now
        
        canvas.restoreState()
    
    # Enhanced Title Styles for PDF Export
    college_style = ParagraphStyle(
        'CollegeTitle',
        parent=styles['Heading1'],
        fontSize=15,
        textColor=colors.HexColor("#1B365D"),
        alignment=1, # Center alignment
        spaceAfter=5
    )
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading2'],
        fontSize=11,
        textColor=colors.HexColor("#333333"),
        alignment=1, # Center alignment
        spaceAfter=5
    )
    timestamp_style = ParagraphStyle(
        'TimestampStyle',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.HexColor("#1B365D"),
        fontName='Helvetica-Bold',
        alignment=1,
        spaceAfter=15
    )
    
    # Metadata Context Extraction
    contest_name = str(dataset.get("contestName") or dataset.get("sessionName") or "WEEKLY CONTEST").split("\n")[0].strip()
    report_type = str(dataset.get("reportType") or dataset.get("report_type") or "").upper().strip()
    raw_title = dataset.get("reportTitle") or dataset.get("title") or ""
    
    # Robust Title Logic
    if report_type == "HISTORICAL_CONTEST_INTELLIGENCE":
        session_headers = dataset.get("sessionHeaders", [])
        if session_headers and len(session_headers) >= 1:
            first_c = session_headers[0].get("contestNum")
            last_c = session_headers[-1].get("contestNum")
            if first_c and last_c and first_c != last_c:
                report_title = f"WEEKLY CONTEST {first_c} TO {last_c} — HISTORICAL INTELLIGENCE REPORT"
            elif first_c:
                report_title = f"WEEKLY CONTEST {first_c} — HISTORICAL INTELLIGENCE REPORT"
            else:
                report_title = "HISTORICAL INTELLIGENCE REPORT"
        else:
            report_title = "HISTORICAL INTELLIGENCE REPORT"
    else:
        if raw_title:
            report_title = str(raw_title).upper().strip()
        else:
            # Fallbacks
            if report_type == "WOW_INTEL" or report_type == "WEEK_ON_WEEK_INTELLIGENCE":
                report_title = f"{contest_name} — WEEK-ON-WEEK INTELLIGENCE REPORT"
            elif report_type == "SUNDAY_LIVE_CONTEST" or report_type == "SUNDAY_LIVE":
                report_title = f"{contest_name} — SUNDAY LIVE CONTEST REPORT"
            elif report_type == "FRIDAY_OFFICIAL_CONTEST" or report_type == "FRIDAY_OFFICIAL":
                report_title = f"{contest_name} — OFFICIAL FRIDAY CONTEST RESULT"
            elif report_type == "WEEKLY_CONTEST_INTELLIGENCE":
                report_title = f"{contest_name} — WEEKLY CONTEST INTELLIGENCE"
            elif report_type == "CONTEST_ATTENDANCE_PARTICIPATION":
                report_title = f"{contest_name} — ATTENDANCE & PARTICIPATION REPORT"
            elif report_type == "CONTEST_PERFORMANCE_RANKING":
                report_title = f"{contest_name} — PERFORMANCE & RANKING REPORT"
            elif report_type == "FIVE_WEEK_PERFORMANCE_TREND" or report_type == "FIVE_WEEK_TREND":
                report_title = f"{contest_name} — 5-WEEK PERFORMANCE TREND"
            elif report_type == "PROBLEM_DIFFICULTY_INTELLIGENCE":
                report_title = f"{contest_name} — PROBLEM DIFFICULTY INTELLIGENCE"
            elif report_type == "FACULTY_CONSOLIDATED":
                report_title = f"{contest_name} — FACULTY CONSOLIDATED PERFORMANCE"
            elif report_type == "COORDINATOR_CONSOLIDATED":
                report_title = f"{contest_name} — FACULTY COORDINATOR CONSOLIDATED"
            elif report_type == "HOD_DEPARTMENT_INTELLIGENCE":
                report_title = f"{contest_name} — HOD DEPARTMENT INTELLIGENCE"
            elif report_type == "COORDINATOR_WEEKLY_PERFORMANCE":
                report_title = f"{contest_name} — COORDINATOR WEEKLY PERFORMANCE"
            elif report_type == "PRINCIPAL_EXECUTIVE":
                report_title = f"{contest_name} — PRINCIPAL EXECUTIVE INTELLIGENCE"
            elif report_type == "MANAGEMENT_EXECUTIVE":
                report_title = f"{contest_name} — MANAGEMENT EXECUTIVE SUMMARY"
            else:
                report_title = f"{contest_name} — PERFORMANCE REPORT"

    # Add Elements to the Document
    # 1. College Logo
    logo_path = r"E:\Leetcode Web\backend\static\nec_25_logo.png"
    if not os.path.exists(logo_path):
        logo_path = r"E:\Leetcode Web\round_logo.png"
        
    if os.path.exists(logo_path):
        img = Image(logo_path, width=65, height=65)
        img.hAlign = 'CENTER'
        elements.append(img)
        elements.append(Spacer(1, 10))
        
    elements.append(Paragraph("<b>NANDHA ENGINEERING COLLEGE (AUTONOMOUS)</b>", college_style))
    elements.append(Paragraph(f"<b>{report_title.upper()}</b>", title_style))
    
    # Add Download Timestamp
    from backend.time_utils import now_ist, format_ist_datetime
    now_str = format_ist_datetime(now_ist())
    elements.append(Paragraph(f"Generated at: {now_str}", timestamp_style))
    
    if not rows:
        # Fallback doc for empty data
        doc = SimpleDocTemplate(output, pagesize=(base_width, doc_height), 
                                rightMargin=margin, leftMargin=margin, topMargin=25, bottomMargin=40)
        elements.append(Paragraph("No data available for this report.", styles["Normal"]))
        doc.build(elements, canvasmaker=NumberedCanvas, onFirstPage=add_page_decorations, onLaterPages=add_page_decorations)
        return output.getvalue()
        
    # Keep font readable
    fs = 8
    hs = 9
    
    # Wrap text in Paragraphs to force line breaks and avoid overflow
    cell_style = ParagraphStyle('CellStyle', parent=styles['Normal'], fontSize=fs, alignment=1, textColor=colors.black, leading=fs+2, wordWrap='CJK')
    left_cell_style = ParagraphStyle('LeftCellStyle', parent=styles['Normal'], fontSize=fs, alignment=0, textColor=colors.black, leading=fs+2, wordWrap='CJK')
    header_style = ParagraphStyle('HeaderStyle', parent=styles['Normal'], fontSize=hs, alignment=1, textColor=colors.white, fontName='Helvetica-Bold', leading=hs+2, wordWrap='CJK')
    
    table_data = []
    table_data.append([Paragraph(h, header_style) for h in clean_headers])
    
    for r in rows:
        row_vals = []
        c_idx = 0
        for h in first_row.keys():
            if h == "weeklyData":
                wd_list = r.get("weeklyData") or []
                wd_map = {wd.get("contestNum"): wd for wd in wd_list}
                for c_num in weekly_data_keys:
                    wd_val = wd_map.get(c_num)
                    if wd_val and wd_val.get("att"):
                        solved = wd_val.get("solved", 0)
                        row_vals.append(Paragraph(str(solved), cell_style))
                    else:
                        row_vals.append(Paragraph("-", cell_style))
                    c_idx += 1
            else:
                val = str(r.get(h) if r.get(h) is not None else "")
                h_name = clean_headers[c_idx].lower()
                c_style = left_cell_style if ("name" in h_name or "url" in h_name) else cell_style
                row_vals.append(Paragraph(val, c_style))
                c_idx += 1
        table_data.append(row_vals)
        
    # Calculate balanced relative weights for columns
    min_widths = []
    for h in clean_headers:
        hl = h.lower()
        if "url" in hl:
            min_widths.append(3.0)
        elif "name" in hl or "username" in hl or "email" in hl:
            min_widths.append(2.0)
        elif "reg" in hl:
            min_widths.append(1.5)
        elif "department" in hl or "dept" in hl or "status" in hl or "solved" in hl or "trend" in hl or "delta" in hl or "attended" in hl:
            min_widths.append(1.7)
        elif "total" in hl or "consist" in hl:
            min_widths.append(1.4)
        else:
            min_widths.append(1.0)
            
    # Each 1.0 of weight needs roughly 50 points of width to be readable without awkward header wrapping
    required_table_width = sum(min_widths) * 50
    
    # Expand horizontally only if the table truly cannot fit in A4
    if required_table_width > (base_width - margin * 2):
        doc_width = required_table_width + (margin * 2)
    else:
        doc_width = base_width
        
    usable_width = doc_width - (margin * 2)
    
    # Scale column widths to perfectly fill the document width
    total_min = sum(min_widths)
    col_widths = [(w / total_min) * usable_width for w in min_widths]
    
    doc = SimpleDocTemplate(output, pagesize=(doc_width, doc_height), 
                            rightMargin=margin, leftMargin=margin, topMargin=25, bottomMargin=40)
    
    # Create Table with colWidths so it is forced to stay inside the page
    t = Table(table_data, colWidths=col_widths, repeatRows=1)
    
    # Style Table
    table_style = [
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#0F172A")),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('TOPPADDING', (0, 0), (-1, 0), 8),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 5),
        ('TOPPADDING', (0, 1), (-1, -1), 5),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#94A3B8"))
    ]
    
    for i in range(1, len(table_data)):
        bg_color = colors.HexColor("#F8FAFC") if i % 2 == 0 else colors.white
        table_style.append(('BACKGROUND', (0, i), (-1, i), bg_color))
        
    t.setStyle(TableStyle(table_style))
    
    elements.append(t)
    doc.build(elements, canvasmaker=NumberedCanvas, onFirstPage=add_page_decorations, onLaterPages=add_page_decorations)
    return output.getvalue()
