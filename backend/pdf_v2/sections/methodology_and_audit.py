"""
SECTION 11, 12, 13: Data Availability, Methodology & Audit Metadata
"""

from reportlab.platypus import Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib import colors
from reportlab.lib.units import inch

from backend.pdf_v2.styles import (
    COLOR_PRIMARY_NAVY, COLOR_SECONDARY_BLUE, COLOR_BG_LIGHT, COLOR_BORDER
)


def build_methodology_and_audit(dataset: dict, styles: dict, table_style: TableStyle) -> list:
    story = []
    meta = dataset.get("metadata", {})
    avail = dataset.get("data_availability", {})
    val = dataset.get("data_validation", {})

    story.append(Paragraph("<b>11. DATA AVAILABILITY & TELEMETRY INTEGRITY</b>", styles['SectionTitle']))
    
    tot_s = avail.get("total_students", 0)
    avail_cnt = avail.get("available_count", 0)
    part_cnt = avail.get("partial_count", 0)
    not_cnt = avail.get("not_available_count", 0)

    avail_data = [
        [
            Paragraph("<b>Telemetry Status</b>", styles['TH']),
            Paragraph("<b>Student Count</b>", styles['TH']),
            Paragraph("<b>Percentage %</b>", styles['TH']),
            Paragraph("<b>Operational Description</b>", styles['THLeft'])
        ],
        [
            Paragraph("<font color='#059669'><b>AVAILABLE</b></font>", styles['TDBold']),
            Paragraph(str(avail_cnt), styles['TD']),
            Paragraph(f"{(avail_cnt/max(1, tot_s)*100):.1f}%", styles['TD']),
            Paragraph("Verified active profile with real-time synchronized problem and contest metrics.", styles['TDLeft'])
        ],
        [
            Paragraph("<font color='#D97706'><b>PARTIAL</b></font>", styles['TDBold']),
            Paragraph(str(part_cnt), styles['TD']),
            Paragraph(f"{(part_cnt/max(1, tot_s)*100):.1f}%", styles['TD']),
            Paragraph("Registered LeetCode handle with 0 verified solves or pending initial sync.", styles['TDLeft'])
        ],
        [
            Paragraph("<font color='#DC2626'><b>NOT_AVAILABLE</b></font>", styles['TDBold']),
            Paragraph(str(not_cnt), styles['TD']),
            Paragraph(f"{(not_cnt/max(1, tot_s)*100):.1f}%", styles['TD']),
            Paragraph("Unlinked profile or invalid username requiring department coordinator action.", styles['TDLeft'])
        ]
    ]

    t_avail = Table(avail_data, colWidths=[1.8*inch, 1.4*inch, 1.5*inch, 6.0*inch], repeatRows=1)
    t_avail.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), COLOR_PRIMARY_NAVY),
        ('GRID', (0, 0), (-1, -1), 0.5, COLOR_BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, COLOR_BG_LIGHT])
    ]))
    story.append(t_avail)
    story.append(Spacer(1, 10))

    # 12. Methodology
    story.append(Paragraph("<b>12. METHODOLOGY & REPORTING RULES</b>", styles['SectionTitle']))
    methodology_text = (
        "<b>1. Data Ingestion:</b> Platform statistics are fetched directly via official LeetCode GraphQL / API adapters "
        "and validated against institutional student enrollment records.<br/>"
        "<b>2. Delta Progression:</b> Weekly problem growth represents net verified solves between consecutive weekly snapshot cycles (W-2 -> W-1 -> Current).<br/>"
        "<b>3. Zero-Value Integrity:</b> Missing or unverified profiles are strictly flagged as N/A or NOT_AVAILABLE; no missing data is converted to zero.<br/>"
        "<b>4. Risk Scoring Engine:</b> Calculates multidimensional engagement risk (0–100) combining solve velocity, active days, and streak continuity."
    )
    t_meth = Table([[Paragraph(methodology_text, styles['NormalText'])]], colWidths=[10.7*inch])
    t_meth.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#F0FDF4")),
        ('BOX', (0, 0), (-1, -1), 0.75, colors.HexColor("#86EFAC")),
        ('PADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(t_meth)
    story.append(Spacer(1, 10))

    # 13. Audit Metadata & Sign-off
    story.append(Paragraph("<b>13. AUDIT METADATA & INSTITUTIONAL AUTHORIZATION</b>", styles['SectionTitle']))
    
    audit_data = [
        [
            Paragraph(f"<b>Snapshot Identifier:</b> <code>{meta.get('snapshot_id')}</code>", styles['NormalText']),
            Paragraph(f"<b>Audit Hash:</b> <code>{meta.get('audit_hash', '')[:28]}...</code>", styles['NormalText']),
            Paragraph(f"<b>Generation Timestamp:</b> {meta.get('generated_at')}", styles['NormalText'])
        ],
        [
            Paragraph("<br/><br/>____________________________<br/><b>HoD / Faculty Coordinator</b>", styles['NormalText']),
            Paragraph("<br/><br/>____________________________<br/><b>Dean – Academic & Research</b>", styles['NormalText']),
            Paragraph("<br/><br/>____________________________<br/><b>Principal / Executive Authority</b>", styles['NormalText'])
        ]
    ]

    t_audit = Table(audit_data, colWidths=[3.56*inch]*3)
    t_audit.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), COLOR_BG_LIGHT),
        ('GRID', (0, 0), (-1, -1), 0.5, COLOR_BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ALIGN', (0, 1), (-1, 1), 'CENTER'),
        ('PADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(t_audit)

    return story
