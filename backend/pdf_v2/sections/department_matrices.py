"""
SECTION 6: Department-wise DSA Topic Matrix & Department-wise Programming Language Matrix
"""

from reportlab.platypus import Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors
from reportlab.lib.units import inch

from backend.pdf_v2.styles import (
    COLOR_PRIMARY_NAVY, COLOR_SECONDARY_BLUE, COLOR_BG_LIGHT, COLOR_BORDER
)


def build_department_matrices(dataset: dict, styles: dict, table_style: TableStyle) -> list:
    story = []
    depts = dataset.get("department_list", [])
    dsa_data = dataset.get("dsa_topic_intelligence", {})
    top_topics = [t["topic_name"] for t in dsa_data.get("top_topics", [])[:8]] or ["Array", "String", "Tree", "Dynamic Programming", "Graph", "Sorting"]
    dept_dsa = dsa_data.get("dept_matrix", {})

    lang_data = dataset.get("language_intelligence", {})
    top_langs = [l["language_name"] for l in lang_data.get("top_languages", [])[:6]] or ["Java", "Python", "C++", "MySQL", "C", "JavaScript"]
    dept_lang = lang_data.get("dept_matrix", {})

    # 1. Department x DSA Topic Matrix
    story.append(Paragraph("<b>6A. DEPARTMENT X DSA TOPIC COMPETENCY MATRIX</b>", styles['SectionTitle']))
    
    hdr_row = [Paragraph("<b>Department</b>", styles['THLeft']), Paragraph("<b>Students</b>", styles['TH'])]
    for t_name in top_topics:
        hdr_row.append(Paragraph(f"<b>{t_name[:12]}</b>", styles['TH']))
    hdr_row.append(Paragraph("<b>Total DSA</b>", styles['TH']))

    dsa_matrix_data = [hdr_row]

    for d in depts:
        d_code = d.get("department", "CSE")
        row = [
            Paragraph(f"<b>{d_code}</b>", styles['TDLeft']),
            Paragraph(str(d.get("total_students", 0)), styles['TD'])
        ]
        row_tot = 0
        for t_name in top_topics:
            cnt = dept_dsa.get(d_code, {}).get(t_name, 0)
            row_tot += cnt
            row.append(Paragraph(str(cnt) if cnt > 0 else "-", styles['TD']))
        row.append(Paragraph(f"<b>{row_tot:,}</b>", styles['TDBold']))
        dsa_matrix_data.append(row)

    # Dynamic column widths
    n_topics = len(top_topics)
    col_w_topic = 8.2 / max(1, (n_topics + 1))
    col_widths_dsa = [1.6*inch, 0.9*inch] + [col_w_topic*inch]*n_topics + [1.0*inch]

    t_dsa_mat = Table(dsa_matrix_data, colWidths=col_widths_dsa, repeatRows=1)
    t_dsa_mat.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), COLOR_PRIMARY_NAVY),
        ('GRID', (0, 0), (-1, -1), 0.5, COLOR_BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, COLOR_BG_LIGHT])
    ]))
    story.append(t_dsa_mat)
    story.append(Spacer(1, 14))

    # 2. Department x Language Matrix
    story.append(Paragraph("<b>6B. DEPARTMENT X PROGRAMMING LANGUAGE MATRIX</b>", styles['SectionTitle']))
    
    lang_hdr = [Paragraph("<b>Department</b>", styles['THLeft']), Paragraph("<b>Students</b>", styles['TH'])]
    for l_name in top_langs:
        lang_hdr.append(Paragraph(f"<b>{l_name}</b>", styles['TH']))
    lang_hdr.append(Paragraph("<b>Total Lang Solves</b>", styles['TH']))

    lang_matrix_data = [lang_hdr]

    for d in depts:
        d_code = d.get("department", "CSE")
        row = [
            Paragraph(f"<b>{d_code}</b>", styles['TDLeft']),
            Paragraph(str(d.get("total_students", 0)), styles['TD'])
        ]
        row_tot = 0
        for l_name in top_langs:
            cnt = dept_lang.get(d_code, {}).get(l_name, 0)
            row_tot += cnt
            row.append(Paragraph(str(cnt) if cnt > 0 else "-", styles['TD']))
        row.append(Paragraph(f"<b>{row_tot:,}</b>", styles['TDBold']))
        lang_matrix_data.append(row)

    n_langs = len(top_langs)
    col_w_lang = 8.2 / max(1, (n_langs + 1))
    col_widths_lang = [1.6*inch, 0.9*inch] + [col_w_lang*inch]*n_langs + [1.1*inch]

    t_lang_mat = Table(lang_matrix_data, colWidths=col_widths_lang, repeatRows=1)
    t_lang_mat.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), COLOR_SECONDARY_BLUE),
        ('GRID', (0, 0), (-1, -1), 0.5, COLOR_BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, COLOR_BG_LIGHT])
    ]))
    story.append(t_lang_mat)
    story.append(Spacer(1, 10))

    return story
