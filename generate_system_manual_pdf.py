import os
import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super(NumberedCanvas, self).__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super(NumberedCanvas, self).showPage()
        super(NumberedCanvas, self).save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Times-Roman", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        
        # Header (pages > 1)
        if self._pageNumber > 1:
            self.drawString(54, 750, "Nandha Engineering College (Autonomous) | Automated LeetCode Engine Manual")
            self.setStrokeColor(colors.HexColor("#CBD5E1"))
            self.setLineWidth(0.5)
            self.line(54, 742, 558, 742)

        # Footer
        page_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(558, 36, page_text)
        self.drawString(54, 36, "CONFIDENTIAL & PROPRIETARY — NANDHA ENGINEERING COLLEGE")
        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.5)
        self.line(54, 48, 558, 48)
        
        self.restoreState()


def build_manual_pdf(filename="Nandha_LeetCode_Engine_Complete_Manual.pdf"):
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )

    styles = getSampleStyleSheet()
    
    # Custom Palette
    primary_color = colors.HexColor("#1B365D")  # Navy
    accent_color = colors.HexColor("#0D9488")   # Teal
    dark_gray = colors.HexColor("#1E293B")
    body_color = colors.HexColor("#334155")
    card_bg = colors.HexColor("#F8FAFC")
    border_color = colors.HexColor("#E2E8F0")

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Times-Bold',
        fontSize=20,
        leading=24,
        textColor=primary_color,
        alignment=1, # Center
        spaceAfter=8
    )

    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Times-Italic',
        fontSize=11,
        leading=15,
        textColor=accent_color,
        alignment=1,
        spaceAfter=15
    )

    h1_style = ParagraphStyle(
        'Heading1_Custom',
        parent=styles['Heading1'],
        fontName='Times-Bold',
        fontSize=14,
        leading=18,
        textColor=primary_color,
        spaceBefore=14,
        spaceAfter=6,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'Heading2_Custom',
        parent=styles['Heading2'],
        fontName='Times-Bold',
        fontSize=11,
        leading=15,
        textColor=accent_color,
        spaceBefore=10,
        spaceAfter=4,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'Body_Custom',
        parent=styles['Normal'],
        fontName='Times-Roman',
        fontSize=9.5,
        leading=13.5,
        textColor=body_color,
        spaceAfter=6
    )

    bullet_style = ParagraphStyle(
        'Bullet_Custom',
        parent=body_style,
        leftIndent=15,
        firstLineIndent=-10,
        spaceAfter=3
    )

    table_header_style = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Times-Bold',
        fontSize=8.5,
        leading=11,
        textColor=colors.white,
        alignment=1
    )

    table_body_style = ParagraphStyle(
        'TableBody',
        parent=styles['Normal'],
        fontName='Times-Roman',
        fontSize=8,
        leading=11,
        textColor=dark_gray
    )

    story = []

    # ─────────────────────────────────────────────────────────────────────────
    # COVER / HEADER BANNER
    # ─────────────────────────────────────────────────────────────────────────
    story.append(Paragraph("NANDHA ENGINEERING COLLEGE (AUTONOMOUS)", title_style))
    story.append(Paragraph("DEPARTMENT OF COMPUTER SCIENCE & ENGINEERING", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=primary_color, spaceBefore=0, spaceAfter=12))
    
    story.append(Paragraph("AUTOMATED LEETCODE WEEKLY CONTEST ENGINE & ANALYTICS PLATFORM", ParagraphStyle(
        'MainTitle', fontName='Times-Bold', fontSize=15, leading=19, textColor=primary_color, alignment=1, spaceAfter=6
    )))
    story.append(Paragraph("Complete Operational User Manual, System Architecture & Lifecycle Guide", ParagraphStyle(
        'SubMain', fontName='Times-Roman', fontSize=10, leading=14, textColor=dark_gray, alignment=1, spaceAfter=15
    )))

    # Metadata Card
    meta_data = [
        [Paragraph("<b>Document Version:</b> 2.0 (Production Release)", table_body_style), Paragraph("<b>Target Environment:</b> Live Production", table_body_style)],
        [Paragraph("<b>Frontend:</b> Firebase Hosting (SPA)", table_body_style), Paragraph("<b>Backend:</b> Render Docker Container (FastAPI)", table_body_style)],
        [Paragraph("<b>Database:</b> SQLite WAL + Immutable Snapshots", table_body_style), Paragraph("<b>Target Cohort:</b> II, III, IV Year (302 Students)", table_body_style)],
    ]
    t_meta = Table(meta_data, colWidths=[250, 254])
    t_meta.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), card_bg),
        ('BOX', (0,0), (-1,-1), 1, border_color),
        ('INNERGRID', (0,0), (-1,-1), 0.5, border_color),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(t_meta)
    story.append(Spacer(1, 14))

    # ─────────────────────────────────────────────────────────────────────────
    # CHAPTER 1: SYSTEM OVERVIEW
    # ─────────────────────────────────────────────────────────────────────────
    story.append(Paragraph("1. Executive System Overview", h1_style))
    story.append(Paragraph(
        "The Nandha Engineering College LeetCode Platform is a fully autonomous, production-grade tracking and analytics system designed to monitor, verify, analyze, and report competitive programming activity for 300+ students across CSE (Cyber Security) and CSE (IoT) departments. It operates continuously without requiring manual administrative page refreshing.",
        body_style
    ))
    story.append(Paragraph(
        "<b>Core Pillars of the Platform:</b>", body_style
    ))
    story.append(Paragraph("• <b>Zero Data Guessing / Fabrication:</b> Strictly classifies participation into <code>ACTUAL</code>, <code>VIRTUAL</code>, or <code>NOT_VERIFIED</code> based on cryptographic evidence.", bullet_style))
    story.append(Paragraph("• <b>Dynamic Contest Discovery:</b> Discovers upcoming weekly contests (WC-515, WC-516, WC-517...) directly from public LeetCode metadata with zero hardcoded numbers or dates.", bullet_style))
    story.append(Paragraph("• <b>Token-Bucket Rate Limiter:</b> Protects institution IP infrastructure at 3.0 req/s, 5 concurrent sockets, and exponential backoff with jitter.", bullet_style))
    story.append(Paragraph("• <b>Immutable Snapshots (SHA-256):</b> Freezes 09:58 AM IST official contest snapshots backed by SQLite trigger-level immutability locks.", bullet_style))
    story.append(Paragraph("• <b>Automated Multi-Format Reporting:</b> Generates and emails high-resolution Excel, PDF, Word, and ZIP packages at 10:00 AM IST sharp.", bullet_style))

    story.append(Spacer(1, 10))

    # ─────────────────────────────────────────────────────────────────────────
    # CHAPTER 2: SUNDAY LIVE CONTEST LIFECYCLE
    # ─────────────────────────────────────────────────────────────────────────
    story.append(Paragraph("2. Sunday Automated Contest Lifecycle", h1_style))
    story.append(Paragraph(
        "Every Sunday, the system executes an automated, multi-phase lifecycle. Administrators do not need to log in or trigger manual fetches during contest hours:",
        body_style
    ))

    lifecycle_table_data = [
        [Paragraph("Time Window (IST)", table_header_style), Paragraph("Lifecycle Phase", table_header_style), Paragraph("Automated System Actions", table_header_style)],
        [
            Paragraph("<b>Mon - Sun 07:59 AM</b>", table_body_style),
            Paragraph("<code>SCHEDULED</code>", table_body_style),
            Paragraph("Active countdown clock displayed in UI. Master student roster (302) prepared.", table_body_style)
        ],
        [
            Paragraph("<b>08:00 AM Sharp</b>", table_body_style),
            Paragraph("<code>AUTO-ACTIVATION</code>", table_body_style),
            Paragraph("Scheduler auto-flips status to <b>LIVE</b>. UI switches to 90-minute live timer via WebSockets / Telemetry.", table_body_style)
        ],
        [
            Paragraph("<b>08:00 - 09:30 AM</b>", table_body_style),
            Paragraph("<code>REAL-TIME SYNC</code>", table_body_style),
            Paragraph("Worker queries active solves every 20s. Streams live solve events (Q1-Q4), rank surges, and updates Top Performers.", table_body_style)
        ],
        [
            Paragraph("<b>09:30 AM Sharp</b>", table_body_style),
            Paragraph("<code>FINALIZING</code>", table_body_style),
            Paragraph("Authoritative full roster sweep executed. Resolves final ranks and score matrices.", table_body_style)
        ],
        [
            Paragraph("<b>09:58 AM Sharp</b>", table_body_style),
            Paragraph("<code>SNAPSHOT LOCK</code>", table_body_style),
            Paragraph("SHA-256 hash computed. Database trigger <code>trg_prevent_snapshot_mutation</code> permanently locks official results.", table_body_style)
        ],
        [
            Paragraph("<b>10:00 AM Sharp</b>", table_body_style),
            Paragraph("<code>REPORT DISPATCH</code>", table_body_style),
            Paragraph("Generates institutional Excel, PDF, Word, ZIP packages and dispatches automated emails to HODs / Principal.", table_body_style)
        ],
        [
            Paragraph("<b>Sun - Wed (3 Days)</b>", table_body_style),
            Paragraph("<code>BOUNDED SWEEP</code>", table_body_style),
            Paragraph("3-day bounded window checks for late virtual practice solves. Lingering unverified rows marked <code>NOT_VERIFIED_FINAL</code>.", table_body_style)
        ],
    ]
    t_life = Table(lifecycle_table_data, colWidths=[110, 110, 284])
    t_life.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), primary_color),
        ('BOX', (0,0), (-1,-1), 1, border_color),
        ('INNERGRID', (0,0), (-1,-1), 0.5, border_color),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t_life)

    story.append(PageBreak())

    # ─────────────────────────────────────────────────────────────────────────
    # CHAPTER 3: ADMIN OPERATIONS & TELEMETRY SUITE
    # ─────────────────────────────────────────────────────────────────────────
    story.append(Paragraph("3. Admin Live Contest Operations & Mission Control", h1_style))
    story.append(Paragraph(
        "The Weekly Contest Dashboard features a centralized <b>Mission-Control Operations Suite</b> with 6 specialized tabs:",
        body_style
    ))

    story.append(Paragraph("<b>Tab Breakdown:</b>", body_style))
    story.append(Paragraph("1. <b>🚀 Live Sync & Controls:</b> Single-worker concurrency lock, Start/Pause/Resume sync buttons, 3-Day sweep trigger, and Force Final Sync button.", bullet_style))
    story.append(Paragraph("2. <b>⚡ Token-Bucket & Rate Limiter:</b> Real-time RPS meter (3.0 req/s, capacity 5.0, 5 socket limit), exponential backoff counter, and throttle telemetry.", bullet_style))
    story.append(Paragraph("3. <b>🛠️ Data Errors & Auto-Resolver:</b> Displays CONFLICT + SOURCE_ERROR rows with 1-click auto-resync and detailed audit reasons.", bullet_style))
    story.append(Paragraph("4. <b>🔒 Snapshot Lock & Windows:</b> Displays cryptographic SHA-256 hash, DB trigger status, and 3-day verification window countdown.", bullet_style))
    story.append(Paragraph("5. <b>📜 Live Events Log Stream:</b> High-contrast terminal-style feed logging student solve events (Q1 Solved, Q2 Solved, Rank Jumps) with millisecond timestamps.", bullet_style))
    story.append(Paragraph("6. <b>🧪 Sandbox & Live Test Sim:</b> Interactive testing lab allowing administrators to trigger sample live cycles (5 realistic solve events) and run a 1-click 5 Core Invariants verification scorecard anytime without waiting for Sunday.", bullet_style))

    story.append(Spacer(1, 10))

    # ─────────────────────────────────────────────────────────────────────────
    # CHAPTER 4: DYNAMIC URL & DATABASE SYNCHRONIZATION ENGINE
    # ─────────────────────────────────────────────────────────────────────────
    story.append(Paragraph("4. Dynamic URL & Database Synchronization Engine", h1_style))
    story.append(Paragraph(
        "The system maintains authoritative consistency when student profile links, names, or contest details change. It guarantees zero duplicate records and immediate cache invalidation:",
        body_style
    ))

    sync_table_data = [
        [Paragraph("Trigger Event", table_header_style), Paragraph("System Normalization & Handling", table_header_style), Paragraph("Database & Cache Impact", table_header_style)],
        [
            Paragraph("<b>New URL Added</b>", table_body_style),
            Paragraph("Auto-normalizes full URL into clean username & canonical link <code>https://leetcode.com/u/xxx/</code>.", table_body_style),
            Paragraph("Creates new student record; immediately clears API memory cache.", table_body_style)
        ],
        [
            Paragraph("<b>URL / Username Changed</b>", table_body_style),
            Paragraph("Matches existing entity by <code>reg_no</code> / <code>student_id</code>.", table_body_style),
            Paragraph("Updates same logical row (0 duplicates). Triggers fresh LeetCode profile re-sync.", table_body_style)
        ],
        [
            Paragraph("<b>Student Name / Dept Edit</b>", table_body_style),
            Paragraph("Synchronizes master roster and updates audit trail.", table_body_style),
            Paragraph("Propagates across all matrix, rank, and leaderboard views instantly.", table_body_style)
        ],
        [
            Paragraph("<b>URL Deleted / Archived</b>", table_body_style),
            Paragraph("Marks <code>CONFIRMED_DELETED</code>. Distinguishes from transient 5xx errors.", table_body_style),
            Paragraph("Deactivates student. Purges cache to prevent stale record resurrection.", table_body_style)
        ],
        [
            Paragraph("<b>Contest URL / Slug Change</b>", table_body_style),
            Paragraph("Updates canonical contest slug on existing logical <code>WeeklySession</code>.", table_body_style),
            Paragraph("Re-links participation records without spawning duplicate contest sessions.", table_body_style)
        ],
    ]
    t_sync = Table(sync_table_data, colWidths=[120, 200, 184])
    t_sync.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), primary_color),
        ('BOX', (0,0), (-1,-1), 1, border_color),
        ('INNERGRID', (0,0), (-1,-1), 0.5, border_color),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t_sync)

    story.append(Spacer(1, 10))

    # ─────────────────────────────────────────────────────────────────────────
    # CHAPTER 5: HOW TO USE (STEP-BY-STEP OPERATIONAL GUIDE)
    # ─────────────────────────────────────────────────────────────────────────
    story.append(Paragraph("5. Step-by-Step User & Faculty Guide", h1_style))
    story.append(Paragraph(
        "<b>A. Cohort & Department Filtering:</b><br/>"
        "Use the dynamic filter bar to select Department (<i>CSE (Cyber Security)</i> / <i>IoT</i>), Academic Year (<i>II Year</i>, <i>III Year</i>, <i>IV Year</i>), and Attendance Status. All stat cards, the 4/4, 3/4, 2/4, 1/4 Problem Breakdown matrix, and the Top Performers Spotlight recalculate dynamically for the selected cohort.",
        body_style
    ))
    story.append(Paragraph(
        "<b>B. Exporting Official Reports (PDF / Word / Excel / ZIP):</b><br/>"
        "Click the respective export buttons in the action toolbar. Reports automatically pull from the authoritative locked snapshot, preserving exact Times New Roman institutional styling, official headers, and department breakdown tables.",
        body_style
    ))
    story.append(Paragraph(
        "<b>C. Running a Live Simulation Demo:</b><br/>"
        "1. Navigate to <b>Admin Live Contest Operations</b>.<br/>"
        "2. Click the <b>🧪 Sandbox & Live Test Sim</b> tab.<br/>"
        "3. Click <b>'Trigger Simulated Solves (5 Live Events)'</b> — observe real-time solve logs stream in.<br/>"
        "4. Click <b>'Validate 5 Core Invariants'</b> — verify the 100% PASS system invariant scorecard.",
        body_style
    ))

    story.append(Spacer(1, 10))

    # ─────────────────────────────────────────────────────────────────────────
    # CHAPTER 6: PRODUCTION DEPLOYMENT & CI STATUS
    # ─────────────────────────────────────────────────────────────────────────
    story.append(Paragraph("6. Deployment Endpoints & Automated CI Status", h1_style))
    
    ci_data = [
        [Paragraph("Deployment Target", table_header_style), Paragraph("Production URL / Environment", table_header_style), Paragraph("Status & Verification", table_header_style)],
        [
            Paragraph("<b>Frontend (React SPA)</b>", table_body_style),
            Paragraph("<font color='#0D9488'><b>https://leetcode-student-data.web.app</b></font>", table_body_style),
            Paragraph("Live on Firebase Hosting (13 assets, gzip optimized)", table_body_style)
        ],
        [
            Paragraph("<b>Backend API & Scheduler</b>", table_body_style),
            Paragraph("Render Docker Web Service (Port 8000)", table_body_style),
            Paragraph("Automated GitHub CI/CD Deployment Active", table_body_style)
        ],
        [
            Paragraph("<b>Automated Test Suite</b>", table_body_style),
            Paragraph("Pytest + Unittest Discover", table_body_style),
            Paragraph("<b>68/68 Pytest PASS</b> (32.78s) | <b>23/23 Unittest PASS</b>", table_body_style)
        ],
    ]
    t_ci = Table(ci_data, colWidths=[130, 210, 164])
    t_ci.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), primary_color),
        ('BOX', (0,0), (-1,-1), 1, border_color),
        ('INNERGRID', (0,0), (-1,-1), 0.5, border_color),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t_ci)

    story.append(Spacer(1, 15))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#94A3B8"), spaceBefore=5, spaceAfter=8))
    story.append(Paragraph("<b>Author:</b> Antigravity AI Engineering Suite | <b>Institution:</b> Nandha Engineering College (Autonomous)", ParagraphStyle(
        'FootNote', fontName='Times-Italic', fontSize=8, leading=11, textColor=colors.HexColor("#64748B"), alignment=1
    )))

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"[SUCCESS] Successfully generated official manual PDF: {filename}")

if __name__ == "__main__":
    build_manual_pdf()
