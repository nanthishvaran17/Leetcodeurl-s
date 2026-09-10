from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.platypus import TableStyle

# Core Theme Colors matching "Friday Weekly LeetCode Intelligence" sample
# Deep Navy/Blue palette
PRIMARY_BLUE = colors.HexColor("#0f172a")      # Slate 900 - Navy Blue
SECONDARY_BLUE = colors.HexColor("#1e293b")    # Slate 800 - Lighter Navy
ACCENT_BLUE = colors.HexColor("#2563eb")       # Blue 600 - Brand Blue
TEXT_MAIN = colors.HexColor("#334155")         # Slate 700 - Standard Text
TEXT_LIGHT = colors.HexColor("#64748b")        # Slate 500 - Light Text
BG_LIGHT = colors.HexColor("#f8fafc")          # Slate 50 - Background Alternate
BG_HEADER = colors.HexColor("#e2e8f0")         # Slate 200 - Table Header BG
BORDER_COLOR = colors.HexColor("#cbd5e1")      # Slate 300 - Standard Border
GROWTH_GREEN = colors.HexColor("#16a34a")      # Green 600
DECLINE_RED = colors.HexColor("#dc2626")       # Red 600

def get_report_styles():
    """Generates a premium dictionary of ReportLab styles for the PDF."""
    styles = getSampleStyleSheet()
    
    return {
        'Title': ParagraphStyle(
            'ReportTitle',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=16,
            leading=20,
            alignment=1, # Center
            textColor=PRIMARY_BLUE
        ),
        'SubTitle': ParagraphStyle(
            'ReportSubTitle',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=10,
            leading=14,
            alignment=1, # Center
            textColor=TEXT_MAIN
        ),
        'SectionHeader': ParagraphStyle(
            'SectionHeader',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=12,
            leading=16,
            alignment=0, # Left
            textColor=PRIMARY_BLUE,
            spaceAfter=10
        ),
        'NormalText': ParagraphStyle(
            'NormalText',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=9,
            leading=12,
            textColor=TEXT_MAIN
        ),
        'MetadataText': ParagraphStyle(
            'MetadataText',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=7,
            leading=9,
            textColor=TEXT_LIGHT
        ),
        'TableCell': ParagraphStyle(
            'TableCell',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=8,
            leading=10,
            alignment=1 # Center
        ),
        'TableCellBold': ParagraphStyle(
            'TableCellBold',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=8,
            leading=10,
            alignment=1
        ),
        'TableCellLeft': ParagraphStyle(
            'TableCellLeft',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=8,
            leading=10,
            alignment=0 # Left
        )
    }

def get_base_table_style():
    """Returns the base TableStyle for all standard data tables."""
    return TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BG_HEADER),
        ('TEXTCOLOR', (0, 0), (-1, 0), PRIMARY_BLUE),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 6),
        ('TOPPADDING', (0, 0), (-1, 0), 6),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, BG_LIGHT])
    ])
