import io
import os
import re
from typing import Dict, List, Any, Optional, Union
from datetime import datetime

from reportlab.lib.pagesizes import landscape, A4
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, PageBreak
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas


class NumberedCanvas(canvas.Canvas):
    """
    Two-pass canvas to dynamically compute and print 'Page X of Y' in footer,
    along with institutional security tags, decorative border, and generation timestamp.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        w, h = self._pagesize

        # Subtle institutional outer border
        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.75)
        self.rect(14, 14, w - 28, h - 28)

        # Footer Left: Institutional tag
        self.setFont('Helvetica-Bold', 7.5)
        self.setFillColor(colors.HexColor("#475569"))
        self.drawString(22, 18, "NANDHA ENGINEERING COLLEGE (AUTONOMOUS)  •  LEETCODE PERFORMANCE INTELLIGENCE")

        # Footer Right: Page X of Y
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(w - 22, 18, page_str)
        self.restoreState()


def _safe_str(val: Any, default: str = "—") -> str:
    if val is None:
        return default
    s = str(val).strip()
    if not s or s.lower() in ("none", "null", "nan"):
        return default
    return s


def _fmt_res(r_val: Any) -> str:
    if not r_val or str(r_val).strip() in ("NOT_PARTICIPATED", "NOT_ATTENDED", "NONE", "—", "null", "None"):
        return "—"
    s = str(r_val).strip()
    if "SOLVED" in s:
        return s.replace("_SOLVED", "/4")
    return s


def export_weekly_performance_pdf(dataset: dict) -> bytes:
    """
    COORDINATOR WEEKLY PERFORMANCE PDF EXPORTER
    Generates a publication-quality institutional landscape PDF directly matching
    the exact 4 sheets of the Excel export and the verified preview:
      - Page 1: Sheet 1 - Leetcode Performance - Weekly Report (Two-level header, Batch, Total Count, Solved buckets, Contests attended, Rating/Ranking)
      - Page 2: Sheet 2 - Leetcode Contest Performance - Weekly Report (Batch, Total Count, Contest Date, Solved 4..0, Rating >2000, >1500, >1250, Global Ranking <20000)
      - Page 3: Sheet 3 - Department Performance Summary (if department summaries present)
      - Page 4+: Sheet 4 - Full Student Roster (S.No, Reg No, Name, Dept, Yr, Easy, Med, Hard, Total, Rating, Rank, Category, Curr Week, Last Week)
    """
    output = io.BytesIO()

    # Base page dimensions: A4 Landscape
    page_w, page_h = landscape(A4)
    margin = 20
    usable_w = page_w - (margin * 2)

    # Resolve Department Name & Academic Coordinator
    d_raw = (dataset.get("department_name") or dataset.get("department") or "").strip()
    if "Cyber" in d_raw or "(CS)" in d_raw or d_raw == "1" or d_raw == "CSE(CS)":
        dept_name = "Department of CSE (Cyber Security)"
        default_coord = "M. Santhoshkumar, AP / CSE (Cyber Security)"
    elif "Things" in d_raw or "IoT" in d_raw or "IOT" in d_raw or d_raw == "2" or d_raw == "CSE(IOT)":
        dept_name = "Department of CSE (Internet of Things )"
        default_coord = "P.Devayani /AP"
    else:
        dept_name = str(dataset.get("department_name") or "Department of CSE (Cyber Security)")
        default_coord = "M. Santhoshkumar, AP / CSE (Cyber Security)"

    coordinator = str(dataset.get("coordinator") or dataset.get("academicCoordinator") or default_coord)

    # Resolve Report Date & Contest Date
    raw_rep_date = None
    candidates = [
        (dataset.get("current_session") or {}).get("session_date"),
        (dataset.get("currentWeek") or {}).get("date"),
        dataset.get("contest_date"),
        dataset.get("contestDate"),
        dataset.get("session_date"),
        dataset.get("sessionDate"),
        (dataset.get("batch_summaries") or [{}])[0].get("contest_date") if dataset.get("batch_summaries") else None,
        dataset.get("report_date"),
        dataset.get("reportDate"),
    ]
    for cand in candidates:
        if cand:
            c_str = str(cand).strip()
            if not c_str.isdigit() and len(c_str) >= 8 and ('.' in c_str or '-' in c_str or '/' in c_str):
                raw_rep_date = c_str
                break

    if not raw_rep_date:
        sid = dataset.get("session_id") or dataset.get("sessionId")
        if sid and str(sid).strip().isdigit():
            try:
                from backend.database import SessionLocal
                from backend.models import WeeklySession
                _db = SessionLocal()
                ws_obj = _db.query(WeeklySession).filter(WeeklySession.id == int(sid)).first()
                if ws_obj and ws_obj.session_date:
                    raw_rep_date = str(ws_obj.session_date).strip()
                _db.close()
            except Exception:
                pass

    if not raw_rep_date:
        raw_rep_date = "18.10.2026"

    report_date = raw_rep_date.replace("-", ".").replace("/", ".")
    raw_c_date = str(dataset.get("contest_date") or dataset.get("contestDate") or report_date)
    contest_date = raw_c_date.replace("-", ".").replace("/", ".")

    # Institutional Cohort Mapping: Support filtering by year (II, III, IV) or showing all cohorts
    all_canonical = [
        {"label": "2023 - 2027", "year": "IV"},
        {"label": "2024 - 2028", "year": "III"},
        {"label": "2025 - 2029", "year": "II"}
    ]
    raw_yr = str(dataset.get("year") or dataset.get("yearFilter") or (dataset.get("filters") or {}).get("year") or "").strip().upper()
    raw_batches_val = dataset.get("batch_summaries")
    raw_batches: List[Dict[str, Any]] = [b for b in raw_batches_val if isinstance(b, dict)] if isinstance(raw_batches_val, list) else []

    if not raw_yr or raw_yr in ("ALL", "NONE", ""):
        if len(raw_batches) == 1 and raw_batches[0].get("year"):
            target_year = raw_batches[0].get("year")
        else:
            target_year = "ALL"
    else:
        target_year = "II" if raw_yr in ("2", "II") else ("III" if raw_yr in ("3", "III") else ("IV" if raw_yr in ("4", "IV") else raw_yr))

    batch_summaries: List[Dict[str, Any]] = []
    if target_year != "ALL":
        batch_summaries = [b for b in raw_batches if b.get("year") == target_year or (b.get("batch") and target_year in str(b.get("batch")))]
        if not batch_summaries:
            found_cb = next((cb for cb in all_canonical if cb["year"] == target_year), None)
            if found_cb:
                batch_summaries = [{
                    "batch": found_cb["label"],
                    "year": found_cb["year"],
                    "total_students": 0,
                    "current_week": {},
                    "last_week": {}
                }]
            else:
                batch_summaries = raw_batches
    else:
        for cb in all_canonical:
            found = next((b for b in raw_batches if str(b.get("batch", "")).replace(" ", "") == cb["label"].replace(" ", "") or b.get("year") == cb["year"]), None)
            if found:
                batch_summaries.append(found)
            else:
                batch_summaries.append({
                    "batch": cb["label"],
                    "year": cb["year"],
                    "total_students": 0,
                    "current_week": {},
                    "last_week": {}
                })

    # Logo Path
    assets_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets")
    logo_path = os.path.join(assets_dir, "round_logo.png")
    if not os.path.exists(logo_path):
        logo_path = os.path.join(assets_dir, "nandha_emblem.png")

    styles = getSampleStyleSheet()

    # Styles
    title_main = ParagraphStyle(
        'MainTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=16,
        textColor=colors.HexColor("#0F172A"),
        alignment=1
    )
    title_sub = ParagraphStyle(
        'SubTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=13,
        textColor=colors.HexColor("#1E293B"),
        alignment=1
    )
    title_meta = ParagraphStyle(
        'MetaDate',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#475569"),
        alignment=1
    )
    title_section = ParagraphStyle(
        'SecTitle',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=14,
        textColor=colors.HexColor("#1B365D"),
        alignment=1
    )
    title_coord = ParagraphStyle(
        'CoordTitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=13,
        textColor=colors.HexColor("#0F172A"),
        alignment=1
    )

    cell_hdr = ParagraphStyle(
        'CellHdr',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor("#0F172A"),
        alignment=1
    )
    cell_hdr_dark = ParagraphStyle(
        'CellHdrDark',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=7.5,
        leading=9.5,
        textColor=colors.white,
        alignment=1
    )
    cell_body = ParagraphStyle(
        'CellBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor("#1E293B"),
        alignment=1
    )
    cell_body_bold = ParagraphStyle(
        'CellBodyBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor("#0F172A"),
        alignment=1
    )
    cell_body_left = ParagraphStyle(
        'CellBodyLeft',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor("#1E293B"),
        alignment=0
    )

    elements = []

    def make_header_block(section_title: str):
        header_elements = []
        img_flow = None
        if os.path.exists(logo_path):
            try:
                img_flow = Image(logo_path, width=42, height=42)
            except Exception:
                pass

        header_paras = [
            Paragraph("<b>NANDHA ENGINEERING COLLEGE, ERODE - 638 052.</b>", title_main),
            Spacer(1, 2),
            Paragraph(f"<b>{dept_name}</b>", title_sub),
            Spacer(1, 2),
            Paragraph(f"Date: <b>{report_date}</b>", title_meta),
            Spacer(1, 3),
            Paragraph(f"<b>{section_title}</b>", title_section),
            Spacer(1, 3),
            Paragraph(f"Name & Designation of the Academic Coordinator: <b>{coordinator}</b>", title_coord),
        ]

        if img_flow:
            tbl = Table([[img_flow, header_paras]], colWidths=[55, usable_w - 55])
            tbl.setStyle(TableStyle([
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('ALIGN', (0, 0), (0, 0), 'CENTER'),
                ('LEFTPADDING', (0, 0), (-1, -1), 0),
                ('RIGHTPADDING', (0, 0), (-1, -1), 0),
                ('TOPPADDING', (0, 0), (-1, -1), 0),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
            ]))
            header_elements.append(tbl)
        else:
            header_elements.extend(header_paras)

        return header_elements

    # =========================================================================
    # PAGE 1: LEETCODE PERFORMANCE - WEEKLY REPORT (Image 1 / Sheet 1)
    # =========================================================================
    elements.extend(make_header_block("Leetcode Performance - Weekly Report"))
    elements.append(Spacer(1, 14))

    # Table 1: 13 columns
    # Column widths summing to ~780 pt (usable_w ~801 pt)
    w1_cols = [105, 65, 48, 48, 48, 48, 52, 45, 45, 45, 45, 78, 80]
    # Sum: 105+65+240+180+158 = 752 pt

    # Header Row 1 (level 1)
    t1_r1 = [
        Paragraph("<b>Batch</b>", cell_hdr),
        Paragraph("<b>Number of Students<br/>(Total Count)</b>", cell_hdr),
        Paragraph("<b>Number of Problems Solved</b>", cell_hdr),
        "", "", "", "",
        Paragraph("<b>Weekly Contest Attended:<br/>(give the count here)</b>", cell_hdr),
        "", "", "",
        Paragraph("<b>Leetcode Contest Rating and<br/>Ranking</b>", cell_hdr),
        ""
    ]
    # Header Row 2 (level 2)
    t1_r2 = [
        "", "",
        Paragraph("<b>Above 500</b>", cell_hdr),
        Paragraph("<b>250 - 500</b>", cell_hdr),
        Paragraph("<b>Less than 250</b>", cell_hdr),
        Paragraph("<b>Less than 100</b>", cell_hdr),
        Paragraph("<b>Not yet started</b>", cell_hdr),
        Paragraph("<b>4 Q Solved</b>", cell_hdr),
        Paragraph("<b>3 Q Solved</b>", cell_hdr),
        Paragraph("<b>2 Q Solved</b>", cell_hdr),
        Paragraph("<b>1 Q Solved</b>", cell_hdr),
        Paragraph("<b>Rating:<br/>Above 1500</b>", cell_hdr),
        Paragraph("<b>Ranking:<br/>Below 20000</b>", cell_hdr),
    ]

    t1_data = [t1_r1, t1_r2]
    t1_style = [
        ('SPAN', (0, 0), (0, 1)),
        ('SPAN', (1, 0), (1, 1)),
        ('SPAN', (2, 0), (6, 0)),
        ('SPAN', (7, 0), (10, 0)),
        ('SPAN', (11, 0), (12, 0)),
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#E2E8F0")),
        ('BACKGROUND', (0, 1), (-1, 1), colors.HexColor("#F1F5F9")),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#94A3B8")),
        ('BOX', (0, 0), (-1, -1), 1.0, colors.HexColor("#475569")),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]

    cur_row_idx = 2
    for b in batch_summaries:
        b_label = str(b.get("batch", ""))
        raw_b_tot = b.get("total_students") or b.get("num_students") or 0
        b_tot = int(raw_b_tot) if isinstance(raw_b_tot, (int, float, str)) else 0
        lw: Dict[str, Any] = b.get("last_week", {}) if isinstance(b.get("last_week"), dict) else {}
        cw: Dict[str, Any] = b.get("current_week", {}) if isinstance(b.get("current_week"), dict) else {}

        # Row 1: Last Week
        row_lw = [
            Paragraph(f"<b>{b_label}</b><br/>(Last Week)", cell_body_bold),
            Paragraph(f"<b>{b_tot}</b>", cell_body_bold),
            Paragraph(str(lw.get("prob_above_500", 0)), cell_body),
            Paragraph(str(lw.get("prob_250_500", 0)), cell_body),
            Paragraph(str(lw.get("prob_100_249", 0)), cell_body),
            Paragraph(str(lw.get("prob_1_99", 0)), cell_body),
            Paragraph(str(lw.get("prob_0", 0)), cell_body),
            Paragraph(str(lw.get("q4", 0)), cell_body),
            Paragraph(str(lw.get("q3", 0)), cell_body),
            Paragraph(str(lw.get("q2", 0)), cell_body),
            Paragraph(str(lw.get("q1", 0)), cell_body),
            Paragraph("-", cell_body),
            Paragraph("-", cell_body),
        ]

        # Row 2: Current Week
        cw_cats = cw.get("categories") or {}
        cw_500 = cw.get("prob_above_500") if cw.get("prob_above_500") is not None else cw_cats.get("Above 500", 0)
        cw_250 = cw.get("prob_250_500") if cw.get("prob_250_500") is not None else cw_cats.get("250 - 500", 0)
        cw_lt250 = cw.get("prob_100_249") if cw.get("prob_100_249") is not None else cw_cats.get("Less than 250", 0)
        cw_lt100 = cw.get("prob_1_99") if cw.get("prob_1_99") is not None else cw_cats.get("Less than 100", 0)
        cw_0 = cw.get("prob_0") if cw.get("prob_0") is not None else cw_cats.get("Not Yet Started", 0)

        cw_r = cw.get("rating_above_1500") or cw.get("rating_1500") or 0
        cw_rnk = cw.get("rank_below_20000") or cw.get("ranking_20000") or 0

        row_cw = [
            Paragraph(f"<b>{b_label}</b><br/>(Current Week)", cell_body_bold),
            Paragraph(f"<b>{b_tot}</b>", cell_body_bold),
            Paragraph(str(cw_500), cell_body_bold),
            Paragraph(str(cw_250), cell_body_bold),
            Paragraph(str(cw_lt250), cell_body_bold),
            Paragraph(str(cw_lt100), cell_body_bold),
            Paragraph(str(cw_0), cell_body_bold),
            Paragraph(str(cw.get("q4", 0)), cell_body_bold),
            Paragraph(str(cw.get("q3", 0)), cell_body_bold),
            Paragraph(str(cw.get("q2", 0)), cell_body_bold),
            Paragraph(str(cw.get("q1", 0)), cell_body_bold),
            Paragraph(str(cw_r) if cw_r and int(cw_r) > 0 else "-", cell_body_bold),
            Paragraph(str(cw_rnk) if cw_rnk and int(cw_rnk) > 0 else "-", cell_body_bold),
        ]

        t1_data.extend([row_lw, row_cw])
        # Vertically span total_students across Last Week and Current Week
        t1_style.append(('SPAN', (1, cur_row_idx), (1, cur_row_idx + 1)))
        t1_style.append(('BACKGROUND', (0, cur_row_idx), (-1, cur_row_idx), colors.white))
        t1_style.append(('BACKGROUND', (0, cur_row_idx + 1), (-1, cur_row_idx + 1), colors.HexColor("#F8FAFC")))
        cur_row_idx += 2

    table_1 = Table(t1_data, colWidths=w1_cols)
    table_1.setStyle(TableStyle(t1_style))
    elements.append(table_1)

    # =========================================================================
    # PAGE 2: LEETCODE CONTEST PERFORMANCE - WEEKLY REPORT (Image 2 / Sheet 2)
    # =========================================================================
    elements.append(PageBreak())
    elements.extend(make_header_block("Leetcode Contest Performance - Weekly Report"))
    elements.append(Spacer(1, 14))

    # Table 2: 12 columns
    w2_cols = [110, 65, 80, 42, 42, 42, 42, 42, 58, 58, 58, 85]
    # Sum: 110+65+80+210+174+85 = 724 pt

    t2_r1 = [
        Paragraph("<b>Batch</b>", cell_hdr),
        Paragraph("<b>Number of Students<br/>(Total Count)</b>", cell_hdr),
        Paragraph("<b>Contest taken on ---<br/>(Date)</b>", cell_hdr),
        Paragraph("<b>Number of Problems Solved</b>", cell_hdr),
        "", "", "", "",
        Paragraph("<b>Leetcode Contest Rating and<br/>Ranking</b>", cell_hdr),
        "", "",
        Paragraph("<b>Global Ranking<br/>Below 20000</b>", cell_hdr),
    ]

    t2_r2 = [
        "", "", "",
        Paragraph("<b>4</b>", cell_hdr),
        Paragraph("<b>3</b>", cell_hdr),
        Paragraph("<b>2</b>", cell_hdr),
        Paragraph("<b>1</b>", cell_hdr),
        Paragraph("<b>0</b>", cell_hdr),
        Paragraph("<b>Above<br/>2000</b>", cell_hdr),
        Paragraph("<b>Above<br/>1500</b>", cell_hdr),
        Paragraph("<b>Above<br/>1250</b>", cell_hdr),
        "",
    ]

    t2_data = [t2_r1, t2_r2]
    t2_style = [
        ('SPAN', (0, 0), (0, 1)),
        ('SPAN', (1, 0), (1, 1)),
        ('SPAN', (2, 0), (2, 1)),
        ('SPAN', (3, 0), (7, 0)),
        ('SPAN', (8, 0), (10, 0)),
        ('SPAN', (11, 0), (11, 1)),
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#E2E8F0")),
        ('BACKGROUND', (0, 1), (-1, 1), colors.HexColor("#F1F5F9")),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#94A3B8")),
        ('BOX', (0, 0), (-1, -1), 1.0, colors.HexColor("#475569")),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]

    cur_row_idx2 = 2
    for b in batch_summaries:
        b_label = str(b.get("batch", ""))
        cw: Dict[str, Any] = b.get("current_week", {}) if isinstance(b.get("current_week"), dict) else {}
        lw: Dict[str, Any] = b.get("last_week", {}) if isinstance(b.get("last_week"), dict) else {}
        raw_b_tot2 = b.get("total_students") or b.get("num_students") or lw.get("total_students") or cw.get("total_students") or 0
        b_tot = int(raw_b_tot2) if isinstance(raw_b_tot2, (int, float, str)) else 0
        c_date = str(b.get("contest_date") or contest_date or report_date)

        q4 = int(cw.get("q4", 0) or 0)
        q3 = int(cw.get("q3", 0) or 0)
        q2 = int(cw.get("q2", 0) or 0)
        q1 = int(cw.get("q1", 0) or 0)
        q0 = cw.get("q0")
        if q0 is None or q0 == 0:
            q0 = max(0, b_tot - (q4 + q3 + q2 + q1))
        else:
            q0 = int(q0)

        r_2000 = cw.get("rating_above_2000") or cw.get("rating_2000") or 0
        r_1500 = cw.get("rating_above_1500") or cw.get("rating_1500") or 0
        r_1250 = cw.get("rating_above_1250") or cw.get("rating_1250") or 0
        rk_20k = cw.get("rank_below_20000") or cw.get("ranking_20000") or 0

        fmt_m = lambda val: str(int(val)) if (isinstance(val, (int, float)) and val > 0) else "—"

        row_c = [
            Paragraph(f"<b>{b_label}</b>", cell_body_bold),
            Paragraph(f"<b>{b_tot}</b>", cell_body_bold),
            Paragraph(c_date, cell_body),
            Paragraph(str(q4), cell_body_bold),
            Paragraph(str(q3), cell_body_bold),
            Paragraph(str(q2), cell_body_bold),
            Paragraph(str(q1), cell_body_bold),
            Paragraph(str(q0), cell_body_bold),
            Paragraph(fmt_m(r_2000), cell_body_bold),
            Paragraph(fmt_m(r_1500), cell_body_bold),
            Paragraph(fmt_m(r_1250), cell_body_bold),
            Paragraph(fmt_m(rk_20k), cell_body_bold),
        ]
        t2_data.append(row_c)
        bg_col = colors.white if cur_row_idx2 % 2 == 0 else colors.HexColor("#F8FAFC")
        t2_style.append(('BACKGROUND', (0, cur_row_idx2), (-1, cur_row_idx2), bg_col))
        cur_row_idx2 += 1

    table_2 = Table(t2_data, colWidths=w2_cols)
    table_2.setStyle(TableStyle(t2_style))
    elements.append(table_2)

    # =========================================================================
    # PAGE 3: DEPARTMENT PERFORMANCE SUMMARY (Sheet 3)
    # =========================================================================
    dept_summaries = dataset.get("department_summaries") or dataset.get("dept_summaries") or []
    if dept_summaries:
        elements.append(PageBreak())
        elements.append(Paragraph("<b>NANDHA ENGINEERING COLLEGE, ERODE - 638 052.</b>", title_main))
        elements.append(Spacer(1, 2))
        elements.append(Paragraph("<b>COORDINATOR WEEKLY PERFORMANCE REPORT — DEPARTMENT PERFORMANCE SUMMARY</b>", title_section))
        elements.append(Spacer(1, 2))
        elements.append(Paragraph(f"Report Date: <b>{report_date}</b>  |  Total Roster: <b>{dataset.get('total_students', len(dept_summaries))} Students</b>", title_meta))
        elements.append(Spacer(1, 14))

        # 13 columns
        w3_cols = [30, 80, 160, 42, 45, 52, 58, 48, 48, 42, 42, 42, 42]
        # Sum: 731 pt

        t3_headers = ["S.No", "Department", "Coordinator", "Total", "Verified", "Avg Solved", "Total Solved", "Above 500", "250–500", "4/4", "3/4", "2/4", "1/4"]
        t3_data = [[Paragraph(f"<b>{h}</b>", cell_hdr_dark) for h in t3_headers]]
        t3_style = [
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#0F172A")),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#94A3B8")),
            ('BOX', (0, 0), (-1, -1), 1.0, colors.HexColor("#475569")),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]

        for d_i, d in enumerate(dept_summaries, 1):
            d_cats = d.get("categories") or {}
            d_cw = d.get("current_week") or {}
            d_metrics = d.get("metrics") or {}
            row_dept = [
                Paragraph(str(d_i), cell_body),
                Paragraph(f"<b>{d.get('department') or d.get('dept') or ''}</b>", cell_body_left),
                Paragraph(str(d.get("coordinator") or "—"), cell_body_left),
                Paragraph(str(d.get("total_students", 0)), cell_body_bold),
                Paragraph(str(d_metrics.get("verified_students", d.get("total_students", 0))), cell_body),
                Paragraph(str(d_metrics.get("average_solved", 0)), cell_body),
                Paragraph(str(d_metrics.get("total_solved", 0)), cell_body),
                Paragraph(str(d_cats.get("Above 500", 0)), cell_body),
                Paragraph(str(d_cats.get("250 - 500") or d_cats.get("250–500", 0)), cell_body),
                Paragraph(str(d_cw.get("q4", 0)), cell_body_bold),
                Paragraph(str(d_cw.get("q3", 0)), cell_body_bold),
                Paragraph(str(d_cw.get("q2", 0)), cell_body_bold),
                Paragraph(str(d_cw.get("q1", 0)), cell_body_bold),
            ]
            t3_data.append(row_dept)
            bg = colors.white if d_i % 2 == 1 else colors.HexColor("#F8FAFC")
            t3_style.append(('BACKGROUND', (0, d_i), (-1, d_i), bg))

        table_3 = Table(t3_data, colWidths=w3_cols)
        table_3.setStyle(TableStyle(t3_style))
        elements.append(table_3)

    # =========================================================================
    # PAGE 4+: FULL STUDENT ROSTER (Sheet 4 / Table in Preview)
    # =========================================================================
    raw_roster = dataset.get("all_students_current") or dataset.get("allStudents") or dataset.get("rows") or []
    if target_year != "ALL":
        y_aliases = {target_year}
        if target_year == "II": y_aliases.update({"2", "2ND", "II YEAR"})
        elif target_year == "III": y_aliases.update({"3", "3RD", "III YEAR"})
        elif target_year == "IV": y_aliases.update({"4", "4TH", "IV YEAR"})
        filtered_roster = [
            s for s in raw_roster 
            if str(s.get("year") or s.get("year_level") or s.get("academic_year") or "").strip().upper() in y_aliases
            or target_year in str(s.get("year") or s.get("year_level") or s.get("academic_year") or "").strip().upper()
        ]
        roster_rows = filtered_roster if filtered_roster else raw_roster
    else:
        roster_rows = raw_roster

    elements.append(PageBreak())
    yr_header_text = f"{target_year} Year" if target_year != "ALL" else "All Years"
    elements.append(Paragraph("<b>NANDHA ENGINEERING COLLEGE, ERODE - 638 052.</b>", title_main))
    elements.append(Spacer(1, 2))
    elements.append(Paragraph(f"<b>COORDINATOR WEEKLY PERFORMANCE REPORT — FULL STUDENT ROSTER ({yr_header_text.upper()})</b>", title_section))
    elements.append(Spacer(1, 2))
    elements.append(Paragraph(
        f"{dept_name}  •  COHORT: <b>{yr_header_text}</b>  |  Date: <b>{report_date}</b>  |  Total Roster: <b>{len(roster_rows)} Students</b>",
        title_meta
    ))
    elements.append(Spacer(1, 10))

    # 14 Columns matching Excel Sheet 4:
    # S.No, Reg No, Student Name, Dept, Yr, Easy, Med, Hard, Total, Rating, Rank, Category, Curr Week, Last Week
    w4_cols = [28, 75, 125, 50, 26, 34, 34, 34, 40, 52, 60, 78, 54, 54]
    # Sum: 28+75+125+50+26+34+34+34+40+52+60+78+54+54 = 744 pt (comfortably fits usable_w ~801 pt)

    r_headers = ["S.No", "Register No", "Student Name", "Dept", "Yr", "Easy", "Med", "Hard", "Total", "Rating", "Rank", "Category", "Curr Week", "Last Week"]
    t4_data = [[Paragraph(f"<b>{h}</b>", cell_hdr_dark) for h in r_headers]]
    t4_style = [
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#0F172A")),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
        ('BOX', (0, 0), (-1, -1), 1.0, colors.HexColor("#64748B")),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]

    for idx, s in enumerate(roster_rows, 1):
        pub_res = _fmt_res(s.get("public_result") or s.get("current_week_result") or s.get("current_week") or s.get("curr_week"))
        last_res = _fmt_res(s.get("last_public_result") or s.get("last_week_result") or s.get("last_week"))

        # Contest Rating
        c_rating = "—"
        for rk in ("contest_rating", "rating", "rating_val"):
            rv = s.get(rk)
            if rv is not None and str(rv).strip() not in ("—", "None", "nan", "NaN", "null", "", "0", "1500", "1500.0"):
                try:
                    c_rating = str(int(float(str(rv))))
                except Exception:
                    c_rating = str(rv)
                break

        # Global Rank
        g_rank = "—"
        for rk in ("global_rank", "contest_global_ranking", "contest_global_rank", "contest_rank", "profile_rank"):
            gv = s.get(rk)
            if gv is not None and str(gv).strip() not in ("—", "None", "nan", "NaN", "null", "", "0", "5000001", "5,000,001", "N/A"):
                try:
                    g_rank = f"#{int(float(str(gv))):,}"
                except Exception:
                    g_rank = str(gv)
                break

        easy_v = s.get("easy") if s.get("easy") is not None else s.get("easy_solved", "—")
        med_v = s.get("medium") if s.get("medium") is not None else s.get("medium_solved", "—")
        hard_v = s.get("hard") if s.get("hard") is not None else s.get("hard_solved", "—")
        tot_v = s.get("total_solved") if s.get("total_solved") is not None else s.get("overall_total_solved", "—")

        # Category styling
        cat_str = str(s.get("category") or "—").strip()

        row_cells = [
            Paragraph(str(s.get("s_no") or idx), cell_body),
            Paragraph(str(s.get("reg_no") or s.get("register_no") or "").strip().upper(), cell_body_bold),
            Paragraph(str(s.get("name") or s.get("student_name") or "").strip().upper(), cell_body_left),
            Paragraph(str(s.get("dept") or s.get("department") or ""), cell_body),
            Paragraph(str(s.get("year") or s.get("academic_year") or ""), cell_body),
            Paragraph(str(easy_v), cell_body),
            Paragraph(str(med_v), cell_body),
            Paragraph(str(hard_v), cell_body),
            Paragraph(f"<b>{tot_v}</b>", cell_body_bold),
            Paragraph(c_rating, cell_body),
            Paragraph(g_rank, cell_body),
            Paragraph(cat_str, cell_body),
            Paragraph(f"<b>{pub_res}</b>" if pub_res != "—" else "—", cell_body_bold if pub_res != "—" else cell_body),
            Paragraph(f"<b>{last_res}</b>" if last_res != "—" else "—", cell_body_bold if last_res != "—" else cell_body),
        ]
        t4_data.append(row_cells)
        bg = colors.white if idx % 2 == 1 else colors.HexColor("#F8FAFC")
        t4_style.append(('BACKGROUND', (0, idx), (-1, idx), bg))

    table_4 = Table(t4_data, colWidths=w4_cols, repeatRows=1)
    table_4.setStyle(TableStyle(t4_style))
    elements.append(table_4)

    # Build Document
    doc = SimpleDocTemplate(
        output,
        pagesize=(page_w, page_h),
        leftMargin=margin,
        rightMargin=margin,
        topMargin=margin,
        bottomMargin=28,
        title=f"Coordinator Weekly Performance Report — {dept_name} ({yr_header_text})",
        author="Nandha Engineering College (Autonomous)",
    )

    doc.build(elements, canvasmaker=NumberedCanvas)
    return output.getvalue()
