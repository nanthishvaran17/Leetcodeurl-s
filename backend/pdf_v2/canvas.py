"""
Two-pass Numbered Canvas for Dynamic 'Page X of Y' Pagination, Running Headers & Footers.
"""

from reportlab.pdfgen import canvas
from reportlab.lib import colors


def make_intelligence_numbered_canvas(report_meta: dict):
    class IntelligenceNumberedCanvas(canvas.Canvas):
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

        def draw_page_decorations(self, page_count: int):
            self.saveState()
            self.setFont("Helvetica", 7.5)
            self.setFillColor(colors.HexColor("#64748B"))
            
            page_w, page_h = self._pagesize
            margin_x = 24

            # Top Running Header on pages > 1
            if self._pageNumber > 1:
                self.setStrokeColor(colors.HexColor("#CBD5E1"))
                self.setLineWidth(0.5)
                self.line(margin_x, page_h - 22, page_w - margin_x, page_h - 22)
                
                inst_title = str(report_meta.get("institution") or "NANDHA ENGINEERING COLLEGE (AUTONOMOUS)")
                window_str = str(report_meta.get("window_str") or "Friday Weekly LeetCode Intelligence")
                
                self.drawString(margin_x, page_h - 18, f"{inst_title} • Friday Weekly LeetCode Intelligence")
                self.drawRightString(page_w - margin_x, page_h - 18, f"Window: {window_str} • OFFICIAL")

            # Bottom Running Footer on all pages
            self.setStrokeColor(colors.HexColor("#CBD5E1"))
            self.setLineWidth(0.5)
            self.line(margin_x, 24, page_w - margin_x, 24)
            
            snapshot_id = str(report_meta.get("snapshot_id") or "SNAPSHOT_OFFICIAL")
            rep_date = str(report_meta.get("report_date") or "")
            
            left_footer = f"Nandha Engineering College, Erode – 638 052 | Snapshot: {snapshot_id} | Date: {rep_date} | Confidential • Academic Record"
            page_str = f"Page {self._pageNumber} of {page_count}"
            
            self.drawString(margin_x, 14, left_footer)
            self.drawRightString(page_w - margin_x, 14, page_str)
            self.restoreState()

    return IntelligenceNumberedCanvas
