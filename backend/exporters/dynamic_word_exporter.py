import io
import re
from docx import Document
from docx.shared import Pt, RGBColor, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.section import WD_ORIENT

def export_dynamic_word(dataset: dict) -> bytes:
    doc = Document()
    
    # Set to Landscape and narrow margins to prevent word-wrapping in large tables
    sections = doc.sections
    for section in sections:
        new_width, new_height = section.page_height, section.page_width
        section.orientation = WD_ORIENT.LANDSCAPE
        section.page_width = new_width
        section.page_height = new_height
        section.left_margin = Inches(0.3)
        section.right_margin = Inches(0.3)
        section.top_margin = Inches(0.4)
        section.bottom_margin = Inches(0.4)
    
    # Title
    report_title = dataset.get("reportTitle") or "Dynamic Report"
    title = doc.add_heading(report_title.upper(), level=1)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    for run in title.runs:
        run.font.color.rgb = RGBColor(27, 54, 93)
        run.font.size = Pt(14)
        
    doc.add_paragraph() # Spacer
    
    rows = dataset.get("rows") or dataset.get("allStudents") or dataset.get("all_students_current") or []
    if not rows:
        doc.add_paragraph("No data available for this report.")
        output = io.BytesIO()
        doc.save(output)
        return output.getvalue()
        
    # Extract headers
    first_row = rows[0]
    
    weekly_data_keys = []
    if "weeklyData" in first_row:
        for wd in first_row.get("weeklyData", []):
            weekly_data_keys.append(wd.get("contestNum"))

    clean_headers = []
    headers_keys = list(first_row.keys())
    
    for h in headers_keys:
        if h == "weeklyData":
            for c_num in weekly_data_keys:
                clean_headers.append(f"C{c_num}")
        else:
            formatted_h = re.sub(r'([a-z])([A-Z])', r'\1 \2', h).replace("_", " ").title().replace('Pct', '%')
            clean_headers.append(formatted_h)
            
    num_cols = len(clean_headers)
    table = doc.add_table(rows=1, cols=num_cols)
    table.style = 'Table Grid'
    table.autofit = True
    
    # Write headers
    hdr_cells = table.rows[0].cells
    for i, h in enumerate(clean_headers):
        hdr_cells[i].text = h
        for run in hdr_cells[i].paragraphs[0].runs:
            run.font.bold = True
            run.font.size = Pt(7) # Tiny font so it doesn't wrap
            
    # Write data rows
    for r in rows:
        row_cells = table.add_row().cells
        c_idx = 0
        for h in headers_keys:
            if h == "weeklyData":
                wd_list = r.get("weeklyData") or []
                wd_map = {wd.get("contestNum"): wd for wd in wd_list}
                for c_num in weekly_data_keys:
                    wd_val = wd_map.get(c_num)
                    val = wd_val.get("solved", 0) if wd_val and wd_val.get("att") else "-"
                    row_cells[c_idx].text = str(val)
                    for run in row_cells[c_idx].paragraphs[0].runs:
                        run.font.size = Pt(7)
                    c_idx += 1
            else:
                val = r.get(h)
                row_cells[c_idx].text = str(val) if val is not None else ""
                for run in row_cells[c_idx].paragraphs[0].runs:
                    run.font.size = Pt(7)
                c_idx += 1
                
    output = io.BytesIO()
    doc.save(output)
    return output.getvalue()
