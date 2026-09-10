"""
ReportLab PDF Styling Tokens & Helpers for Friday Weekly LeetCode Intelligence Report.
Designed for high-contrast executive printing & digital consumption.
"""

from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.platypus import TableStyle

# Executive Institutional Palette
COLOR_PRIMARY_NAVY = colors.HexColor("#0F172A")    # Deep Slate 900
COLOR_SECONDARY_BLUE = colors.HexColor("#1E293B")  # Slate 800
COLOR_BRAND_BLUE = colors.HexColor("#1D4ED8")      # Blue 700
COLOR_ACCENT_CYAN = colors.HexColor("#0284C7")     # Sky 600
COLOR_TEXT_MAIN = colors.HexColor("#1E293B")       # Dark Charcoal
COLOR_TEXT_MUTED = colors.HexColor("#64748B")      # Slate 500
COLOR_BG_HEADER = colors.HexColor("#0F2942")       # Header Navy
COLOR_BG_SUBHDR = colors.HexColor("#1E3A5F")       # Subheader Blue
COLOR_BG_LIGHT = colors.HexColor("#F8FAFC")        # Off-white
COLOR_BG_CARD = colors.HexColor("#F1F5F9")         # Slate 100
COLOR_BORDER = colors.HexColor("#CBD5E1")          # Slate 300
COLOR_BORDER_DARK = colors.HexColor("#94A3B8")     # Slate 400

COLOR_SUCCESS = colors.HexColor("#059669")         # Emerald 600
COLOR_WARNING = colors.HexColor("#D97706")         # Amber 600
COLOR_DANGER = colors.HexColor("#DC2626")          # Red 600
COLOR_EASY = colors.HexColor("#10B981")            # Emerald 500
COLOR_MEDIUM = colors.HexColor("#F59E0B")          # Amber 500
COLOR_HARD = colors.HexColor("#EF4444")            # Red 500


def get_report_styles():
    """Returns typography styles for document layout."""
    base_styles = getSampleStyleSheet()
    
    return {
        'DocTitle': ParagraphStyle(
            'DocTitle',
            parent=base_styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=13,
            leading=16,
            textColor=COLOR_PRIMARY_NAVY,
            alignment=1
        ),
        'DocSubTitle': ParagraphStyle(
            'DocSubTitle',
            parent=base_styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=9.5,
            leading=12,
            textColor=COLOR_BRAND_BLUE,
            alignment=1
        ),
        'DeptTitle': ParagraphStyle(
            'DeptTitle',
            parent=base_styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=8.5,
            leading=11,
            textColor=COLOR_PRIMARY_NAVY,
            alignment=1
        ),
        'MetaText': ParagraphStyle(
            'MetaText',
            parent=base_styles['Normal'],
            fontName='Helvetica',
            fontSize=7.5,
            leading=9.5,
            textColor=COLOR_TEXT_MUTED,
            alignment=1
        ),
        'SectionHeader': ParagraphStyle(
            'SectionHeader',
            parent=base_styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=10,
            leading=13,
            textColor=colors.white,
            alignment=0
        ),
        'SectionTitle': ParagraphStyle(
            'SectionTitle',
            parent=base_styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=11,
            leading=14,
            textColor=COLOR_PRIMARY_NAVY,
            alignment=0,
            spaceAfter=6
        ),
        'NormalText': ParagraphStyle(
            'NormalText',
            parent=base_styles['Normal'],
            fontName='Helvetica',
            fontSize=8,
            leading=11,
            textColor=COLOR_TEXT_MAIN
        ),
        'MutedText': ParagraphStyle(
            'MutedText',
            parent=base_styles['Normal'],
            fontName='Helvetica',
            fontSize=7,
            leading=9,
            textColor=COLOR_TEXT_MUTED
        ),
        'TH': ParagraphStyle(
            'TH',
            parent=base_styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=7.5,
            leading=9,
            textColor=colors.white,
            alignment=1
        ),
        'THLeft': ParagraphStyle(
            'THLeft',
            parent=base_styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=7.5,
            leading=9,
            textColor=colors.white,
            alignment=0
        ),
        'TD': ParagraphStyle(
            'TD',
            parent=base_styles['Normal'],
            fontName='Helvetica',
            fontSize=7.5,
            leading=9,
            textColor=COLOR_TEXT_MAIN,
            alignment=1
        ),
        'TDLeft': ParagraphStyle(
            'TDLeft',
            parent=base_styles['Normal'],
            fontName='Helvetica',
            fontSize=7.5,
            leading=9,
            textColor=COLOR_TEXT_MAIN,
            alignment=0
        ),
        'TDBold': ParagraphStyle(
            'TDBold',
            parent=base_styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=7.5,
            leading=9,
            textColor=COLOR_PRIMARY_NAVY,
            alignment=1
        ),
        'TDBoldLeft': ParagraphStyle(
            'TDBoldLeft',
            parent=base_styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=7.5,
            leading=9,
            textColor=COLOR_PRIMARY_NAVY,
            alignment=0
        ),
        'TDSuccess': ParagraphStyle(
            'TDSuccess',
            parent=base_styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=7.5,
            leading=9,
            textColor=COLOR_SUCCESS,
            alignment=1
        ),
        'TDDanger': ParagraphStyle(
            'TDDanger',
            parent=base_styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=7.5,
            leading=9,
            textColor=COLOR_DANGER,
            alignment=1
        ),
        'BadgeEasy': ParagraphStyle(
            'BadgeEasy',
            parent=base_styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=7,
            leading=8,
            textColor=COLOR_EASY,
            alignment=1
        ),
        'BadgeMed': ParagraphStyle(
            'BadgeMed',
            parent=base_styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=7,
            leading=8,
            textColor=COLOR_MEDIUM,
            alignment=1
        ),
        'BadgeHard': ParagraphStyle(
            'BadgeHard',
            parent=base_styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=7,
            leading=8,
            textColor=COLOR_HARD,
            alignment=1
        )
    }


def get_base_table_style(has_header=True):
    """Base table style with clean grid, crisp paddings, and alternating backgrounds."""
    cmds = [
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, COLOR_BORDER),
        ('TOPPADDING', (0, 0), (-1, -1), 2.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5),
        ('LEFTPADDING', (0, 0), (-1, -1), 3),
        ('RIGHTPADDING', (0, 0), (-1, -1), 3),
    ]
    if has_header:
        cmds.extend([
            ('BACKGROUND', (0, 0), (-1, 0), COLOR_BG_HEADER),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, COLOR_BG_LIGHT]),
        ])
    return TableStyle(cmds)
