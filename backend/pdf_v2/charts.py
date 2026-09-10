"""
charts.py — Premium Chart Builder for Friday Weekly LeetCode Intelligence PDF
==============================================================================
Implements all 13 required graphs using ReportLab vector drawing.
Uses the Nandha Intelligence color system for professional, consistent visuals.

COLOR PALETTE:
    Primary Blue   #2563EB    Indigo   #4F46E5    Purple  #7C3AED
    Cyan           #0891B2    Green    #059669     Emerald #10B981
    Amber          #D97706    Orange   #EA580C     Red     #DC2626
    Rose           #E11D48    Slate    #475569

CHARTS:
  1. institutional_trend_chart    — 5-week cumulative solved line/bar
  2. weekly_new_solved_chart      — weekly delta bar chart
  3. contest_participation_chart  — participation trend line
  4. rating_trend_chart           — average rating trend line
  5. dept_comparison_chart        — department horizontal bar
  6. dept_growth_chart            — department growth % bar
  7. year_performance_chart       — academic year grouped bar
  8. q1q4_solve_rate_chart        — Q1-Q4 grouped bar
  9. difficulty_dist_chart        — Easy/Medium/Hard bar
  10. language_usage_chart        — language horizontal bar
  11. topic_dist_chart            — DSA topic horizontal bar
  12. rating_movement_chart       — Gainers/Stable/Decliners bar
  13. risk_distribution_chart     — risk level bar
"""

from typing import Any, Dict, List, Optional, Tuple
from reportlab.platypus import Flowable
from reportlab.lib.units import cm, mm
from reportlab.lib.colors import HexColor, white, black, Color

# ─── Nandha Intelligence Color System ─────────────────────────────────────────
C_BLUE       = HexColor("#2563EB")
C_INDIGO     = HexColor("#4F46E5")
C_PURPLE     = HexColor("#7C3AED")
C_CYAN       = HexColor("#0891B2")
C_GREEN      = HexColor("#059669")
C_EMERALD    = HexColor("#10B981")
C_AMBER      = HexColor("#D97706")
C_ORANGE     = HexColor("#EA580C")
C_RED        = HexColor("#DC2626")
C_ROSE       = HexColor("#E11D48")
C_SLATE      = HexColor("#475569")
C_LIGHT_BG   = HexColor("#F8FAFC")
C_BORDER     = HexColor("#E2E8F0")
C_GRID       = HexColor("#F1F5F9")
C_TEXT_DIM   = HexColor("#94A3B8")
C_TEXT_MAIN  = HexColor("#1E293B")

DEPT_COLORS = [C_BLUE, C_INDIGO, C_PURPLE, C_CYAN, C_GREEN, C_AMBER, C_ORANGE, C_ROSE, C_SLATE, C_EMERALD]

RISK_COLORS = {
    "EXCELLENT":          C_EMERALD,
    "IMPROVING":          C_GREEN,
    "STABLE":             C_BLUE,
    "WATCH":              C_AMBER,
    "AT_RISK":            C_ORANGE,
    "INACTIVE":           C_RED,
    "DATA_REVIEW_REQUIRED": C_SLATE,
}

DIFFICULTY_COLORS = {
    "Easy":   C_EMERALD,
    "Medium": C_AMBER,
    "Hard":   C_RED,
}

LANG_COLORS = [C_BLUE, C_INDIGO, C_CYAN, C_GREEN, C_ORANGE, C_PURPLE, C_AMBER, C_ROSE, C_SLATE, C_EMERALD]


# ─── Base Chart Flowable ───────────────────────────────────────────────────────

class BaseChart(Flowable):
    """Base class for all premium vector charts."""

    def __init__(self, width: float, height: float, title: str = "", subtitle: str = ""):
        super().__init__()
        self.width = width
        self.height = height
        self.chart_title = title
        self.chart_subtitle = subtitle

    def _draw_background(self, canvas):
        canvas.setFillColor(C_LIGHT_BG)
        canvas.roundRect(0, 0, self.width, self.height, radius=4, fill=1, stroke=0)
        canvas.setStrokeColor(C_BORDER)
        canvas.setLineWidth(0.5)
        canvas.roundRect(0, 0, self.width, self.height, radius=4, fill=0, stroke=1)

    def _draw_title(self, canvas, top_y: float) -> float:
        """Draws title and subtitle, returns remaining y after title block."""
        y = top_y
        if self.chart_title:
            canvas.setFont("Helvetica-Bold", 8)
            canvas.setFillColor(C_TEXT_MAIN)
            canvas.drawString(8, y, self.chart_title)
            y -= 11
        if self.chart_subtitle:
            canvas.setFont("Helvetica", 6.5)
            canvas.setFillColor(C_SLATE)
            canvas.drawString(8, y, self.chart_subtitle)
            y -= 9
        return y

    def _draw_no_data(self, canvas, reason: str = "DATA NOT AVAILABLE"):
        """Renders a clear 'no data' state instead of an empty chart."""
        cx = self.width / 2
        cy = self.height / 2
        canvas.setFont("Helvetica-Bold", 9)
        canvas.setFillColor(C_SLATE)
        canvas.drawCentredString(cx, cy + 6, reason)
        canvas.setFont("Helvetica", 7)
        canvas.setFillColor(C_TEXT_DIM)
        canvas.drawCentredString(cx, cy - 8, "No validated data available for this chart")

    def _bar(self, canvas, x, y, w, h, color, label=None, label_font_size=6):
        """Draw a single filled bar with optional top label."""
        if h <= 0:
            return
        canvas.setFillColor(color)
        canvas.setStrokeColor(white)
        canvas.setLineWidth(0.3)
        canvas.rect(x, y, w, h, fill=1, stroke=0)
        if label:
            canvas.setFont("Helvetica-Bold", label_font_size)
            canvas.setFillColor(C_TEXT_MAIN)
            canvas.drawCentredString(x + w / 2, y + h + 2, str(label))

    def _hbar(self, canvas, x, y, w, h, color, label=None, label_font_size=5.5):
        """Draw a horizontal bar."""
        if w <= 0:
            return
        canvas.setFillColor(color)
        canvas.rect(x, y, w, h, fill=1, stroke=0)
        if label:
            canvas.setFont("Helvetica-Bold", label_font_size)
            canvas.setFillColor(C_TEXT_MAIN)
            canvas.drawString(x + w + 3, y + h / 2 - 2.5, str(label))

    def _grid_line(self, canvas, x1, y1, x2, y2):
        canvas.setStrokeColor(C_GRID)
        canvas.setLineWidth(0.4)
        canvas.line(x1, y1, x2, y2)

    def _axis_label(self, canvas, text, x, y, size=5.5, align="center"):
        canvas.setFont("Helvetica", size)
        canvas.setFillColor(C_SLATE)
        if align == "center":
            canvas.drawCentredString(x, y, text)
        elif align == "right":
            canvas.drawRightString(x, y, text)
        else:
            canvas.drawString(x, y, text)

    def _compact_num(self, v) -> str:
        """Format large numbers compactly."""
        try:
            v = float(v)
            if v >= 1000:
                return f"{v/1000:.1f}K"
            return str(int(v))
        except Exception:
            return str(v)


# ─── Chart 1: Institutional Trend (5-week cumulative) ─────────────────────────

class InstitutionalTrendChart(BaseChart):
    """
    Graph 1: 5-week institutional cumulative solved trend.
    Line chart with data points over weekly labels.
    """
    def __init__(self, weeks: List[str], values: List[Optional[int]], **kwargs):
        super().__init__(**kwargs)
        self.weeks = weeks
        self.values = [v for v in values]

    def draw(self):
        c = self.canv
        self._draw_background(c)
        ty = self.height - 10
        ty = self._draw_title(c, ty)

        valid = [(w, v) for w, v in zip(self.weeks, self.values) if v is not None]
        if not valid:
            self._draw_no_data(c)
            return

        pad_l, pad_r, pad_b = 40, 12, 22
        plot_w = self.width - pad_l - pad_r
        plot_h = ty - pad_b - 8
        plot_x, plot_y = pad_l, pad_b

        vals = [v for _, v in valid]
        max_v = max(vals) if vals else 1
        min_v = min(vals) * 0.9

        # Grid lines
        for i in range(4):
            gy = plot_y + (i + 1) * plot_h / 4
            self._grid_line(c, plot_x, gy, plot_x + plot_w, gy)

        # Axis
        c.setStrokeColor(C_BORDER)
        c.setLineWidth(0.8)
        c.line(plot_x, plot_y, plot_x, plot_y + plot_h)
        c.line(plot_x, plot_y, plot_x + plot_w, plot_y)

        # Y-axis labels
        for i in range(5):
            yv = min_v + (max_v - min_v) * i / 4
            py = plot_y + i * plot_h / 4
            self._axis_label(c, self._compact_num(yv), plot_x - 3, py - 2, align="right")

        # Data points and line
        n = len(valid)
        step = plot_w / max(n - 1, 1)
        points = []
        for i, (wk, v) in enumerate(valid):
            px = plot_x + i * step
            py = plot_y + (v - min_v) / max(max_v - min_v, 1) * plot_h
            points.append((px, py))
            # X label
            self._axis_label(c, wk, px, plot_y - 12)

        # Draw line
        c.setStrokeColor(C_BLUE)
        c.setLineWidth(1.5)
        c.setLineCap(1)
        for i in range(len(points) - 1):
            c.line(points[i][0], points[i][1], points[i+1][0], points[i+1][1])

        # Draw dots and labels
        for i, ((px, py), (_, v)) in enumerate(zip(points, valid)):
            c.setFillColor(C_BLUE)
            c.circle(px, py, 3, fill=1, stroke=0)
            c.setFillColor(white)
            c.circle(px, py, 1.5, fill=1, stroke=0)
            c.setFont("Helvetica-Bold", 5.5)
            c.setFillColor(C_BLUE)
            c.drawCentredString(px, py + 5, self._compact_num(v))


# ─── Chart 2: Weekly New Solved ────────────────────────────────────────────────

class WeeklyNewSolvedChart(BaseChart):
    def __init__(self, weeks: List[str], values: List[Optional[int]], **kwargs):
        super().__init__(**kwargs)
        self.weeks = weeks
        self.values = values

    def draw(self):
        c = self.canv
        self._draw_background(c)
        ty = self.height - 10
        ty = self._draw_title(c, ty)

        valid = [(w, v) for w, v in zip(self.weeks, self.values) if v is not None]
        if not valid:
            self._draw_no_data(c)
            return

        pad_l, pad_r, pad_b = 38, 10, 22
        plot_w = self.width - pad_l - pad_r
        plot_h = ty - pad_b - 8
        plot_x, plot_y = pad_l, pad_b
        n = len(valid)
        bar_w = min(plot_w / n * 0.65, 30)
        gap = plot_w / n

        vals = [v for _, v in valid]
        max_v = max(vals) if vals else 1

        for i in range(4):
            gy = plot_y + (i + 1) * plot_h / 4
            self._grid_line(c, plot_x, gy, plot_x + plot_w, gy)

        c.setStrokeColor(C_BORDER)
        c.setLineWidth(0.8)
        c.line(plot_x, plot_y, plot_x, plot_y + plot_h)
        c.line(plot_x, plot_y, plot_x + plot_w, plot_y)

        for i in range(5):
            yv = max_v * i / 4
            py = plot_y + i * plot_h / 4
            self._axis_label(c, self._compact_num(yv), plot_x - 3, py - 2, align="right")

        for i, (wk, v) in enumerate(valid):
            bx = plot_x + i * gap + (gap - bar_w) / 2
            bh = (v / max_v) * plot_h if max_v > 0 else 0
            self._bar(c, bx, plot_y, bar_w, bh, C_INDIGO, self._compact_num(v))
            self._axis_label(c, wk, bx + bar_w / 2, plot_y - 12)


# ─── Chart 3: Contest Participation Trend ─────────────────────────────────────

class ContestParticipationChart(BaseChart):
    def __init__(self, weeks: List[str], values: List[Optional[int]], **kwargs):
        super().__init__(**kwargs)
        self.weeks = weeks
        self.values = values

    def draw(self):
        c = self.canv
        self._draw_background(c)
        ty = self.height - 10
        ty = self._draw_title(c, ty)

        valid = [(w, v) for w, v in zip(self.weeks, self.values) if v is not None]
        if not valid:
            self._draw_no_data(c)
            return

        pad_l, pad_r, pad_b = 36, 12, 22
        plot_w = self.width - pad_l - pad_r
        plot_h = ty - pad_b - 8
        plot_x, plot_y = pad_l, pad_b
        vals = [v for _, v in valid]
        max_v = max(vals) if vals else 1

        for i in range(4):
            gy = plot_y + (i + 1) * plot_h / 4
            self._grid_line(c, plot_x, gy, plot_x + plot_w, gy)
        c.setStrokeColor(C_BORDER); c.setLineWidth(0.8)
        c.line(plot_x, plot_y, plot_x, plot_y + plot_h)
        c.line(plot_x, plot_y, plot_x + plot_w, plot_y)

        for i in range(5):
            yv = max_v * i / 4
            py = plot_y + i * plot_h / 4
            self._axis_label(c, self._compact_num(yv), plot_x - 3, py - 2, align="right")

        n = len(valid)
        step = plot_w / max(n - 1, 1)
        points = []
        for i, (wk, v) in enumerate(valid):
            px = plot_x + i * step
            py = plot_y + (v / max_v) * plot_h if max_v > 0 else plot_y
            points.append((px, py))
            self._axis_label(c, wk, px, plot_y - 12)

        c.setStrokeColor(C_EMERALD); c.setLineWidth(1.5)
        for i in range(len(points) - 1):
            c.line(points[i][0], points[i][1], points[i+1][0], points[i+1][1])
        for px, py in points:
            c.setFillColor(C_EMERALD); c.circle(px, py, 2.8, fill=1, stroke=0)
            c.setFillColor(white); c.circle(px, py, 1.3, fill=1, stroke=0)


# ─── Chart 4: Average Rating Trend ────────────────────────────────────────────

class RatingTrendChart(BaseChart):
    def __init__(self, weeks: List[str], values: List[Optional[float]], **kwargs):
        super().__init__(**kwargs)
        self.weeks = weeks
        self.values = values

    def draw(self):
        c = self.canv
        self._draw_background(c)
        ty = self.height - 10
        ty = self._draw_title(c, ty)

        valid = [(w, v) for w, v in zip(self.weeks, self.values) if v is not None]
        if not valid:
            self._draw_no_data(c)
            return

        pad_l, pad_r, pad_b = 42, 12, 22
        plot_w = self.width - pad_l - pad_r
        plot_h = ty - pad_b - 8
        plot_x, plot_y = pad_l, pad_b
        vals = [v for _, v in valid]
        min_v = max(0, min(vals) * 0.97)
        max_v = max(vals) * 1.02

        for i in range(4):
            gy = plot_y + (i + 1) * plot_h / 4
            self._grid_line(c, plot_x, gy, plot_x + plot_w, gy)
        c.setStrokeColor(C_BORDER); c.setLineWidth(0.8)
        c.line(plot_x, plot_y, plot_x, plot_y + plot_h)
        c.line(plot_x, plot_y, plot_x + plot_w, plot_y)

        rng = max_v - min_v or 1
        for i in range(5):
            yv = min_v + rng * i / 4
            py = plot_y + i * plot_h / 4
            self._axis_label(c, f"{yv:.0f}", plot_x - 3, py - 2, align="right")

        n = len(valid)
        step = plot_w / max(n - 1, 1)
        points = []
        for i, (wk, v) in enumerate(valid):
            px = plot_x + i * step
            py = plot_y + (v - min_v) / rng * plot_h
            points.append((px, py))
            self._axis_label(c, wk, px, plot_y - 12)

        c.setStrokeColor(C_PURPLE); c.setLineWidth(1.5)
        for i in range(len(points) - 1):
            c.line(points[i][0], points[i][1], points[i+1][0], points[i+1][1])
        for (px, py), (_, v) in zip(points, valid):
            c.setFillColor(C_PURPLE); c.circle(px, py, 2.8, fill=1, stroke=0)
            c.setFillColor(white); c.circle(px, py, 1.3, fill=1, stroke=0)
            c.setFont("Helvetica-Bold", 5); c.setFillColor(C_PURPLE)
            c.drawCentredString(px, py + 4.5, f"{v:.0f}")


# ─── Chart 5: Department Comparison (horizontal bar) ──────────────────────────

class DeptComparisonChart(BaseChart):
    def __init__(self, depts: List[str], values: List[int], **kwargs):
        super().__init__(**kwargs)
        self.depts = depts
        self.values = values

    def draw(self):
        c = self.canv
        self._draw_background(c)
        ty = self.height - 10
        ty = self._draw_title(c, ty)

        if not self.depts or not any(v > 0 for v in self.values):
            self._draw_no_data(c)
            return

        pad_l, pad_r, pad_b, pad_t = 70, 50, 10, 5
        plot_w = self.width - pad_l - pad_r
        plot_h = ty - pad_b - pad_t
        plot_x, plot_y = pad_l, pad_b

        n = len(self.depts)
        bar_h = min(plot_h / n * 0.65, 14)
        gap = plot_h / n
        max_v = max(self.values) if self.values else 1

        for i, (dept, v) in enumerate(zip(self.depts, self.values)):
            by = plot_y + (n - 1 - i) * gap + (gap - bar_h) / 2
            bw = (v / max_v) * plot_w if max_v > 0 else 0
            color = DEPT_COLORS[i % len(DEPT_COLORS)]
            self._hbar(c, plot_x, by, bw, bar_h, color, self._compact_num(v))
            # Department label
            c.setFont("Helvetica", 6)
            c.setFillColor(C_TEXT_MAIN)
            c.drawRightString(plot_x - 4, by + bar_h / 2 - 2.5, dept[:12])


# ─── Chart 6: Department Growth % ─────────────────────────────────────────────

class DeptGrowthChart(BaseChart):
    def __init__(self, depts: List[str], values: List[Optional[float]], **kwargs):
        super().__init__(**kwargs)
        self.depts = depts
        self.values = values

    def draw(self):
        c = self.canv
        self._draw_background(c)
        ty = self.height - 10
        ty = self._draw_title(c, ty)

        valid = [(d, v) for d, v in zip(self.depts, self.values) if v is not None]
        if not valid:
            self._draw_no_data(c)
            return

        pad_l, pad_r, pad_b = 30, 10, 28
        plot_w = self.width - pad_l - pad_r
        plot_h = ty - pad_b - 8
        plot_x, plot_y = pad_l, pad_b
        n = len(valid)
        bar_w = min(plot_w / n * 0.7, 28)
        gap = plot_w / n
        vals = [v for _, v in valid]
        max_v = max(max(vals), 5)

        for i in range(4):
            gy = plot_y + (i + 1) * plot_h / 4
            self._grid_line(c, plot_x, gy, plot_x + plot_w, gy)
        c.setStrokeColor(C_BORDER); c.setLineWidth(0.8)
        c.line(plot_x, plot_y, plot_x, plot_y + plot_h)
        c.line(plot_x, plot_y, plot_x + plot_w, plot_y)

        for i in range(5):
            yv = max_v * i / 4
            py = plot_y + i * plot_h / 4
            self._axis_label(c, f"{yv:.0f}%", plot_x - 3, py - 2, align="right")

        for i, (dept, v) in enumerate(valid):
            bx = plot_x + i * gap + (gap - bar_w) / 2
            bh = max(0, v / max_v * plot_h)
            color = C_EMERALD if v >= 5 else (C_AMBER if v >= 0 else C_RED)
            self._bar(c, bx, plot_y, bar_w, bh, color, f"{v:.1f}%", 5.5)
            self._axis_label(c, dept[:6], bx + bar_w / 2, plot_y - 14, size=5.5)


# ─── Chart 7: Academic Year Performance ───────────────────────────────────────

class YearPerformanceChart(BaseChart):
    def __init__(self, years: List[str], solved: List[int], contest: List[int], **kwargs):
        super().__init__(**kwargs)
        self.years = years
        self.solved = solved
        self.contest = contest

    def draw(self):
        c = self.canv
        self._draw_background(c)
        ty = self.height - 10
        ty = self._draw_title(c, ty)

        if not self.years:
            self._draw_no_data(c)
            return

        pad_l, pad_r, pad_b = 36, 10, 26
        plot_w = self.width - pad_l - pad_r
        plot_h = ty - pad_b - 14
        plot_x, plot_y = pad_l, pad_b
        n = len(self.years)
        group_w = plot_w / n
        bar_w = group_w * 0.3
        max_v = max(max(self.solved or [1]), 1)

        for i in range(4):
            gy = plot_y + (i + 1) * plot_h / 4
            self._grid_line(c, plot_x, gy, plot_x + plot_w, gy)
        c.setStrokeColor(C_BORDER); c.setLineWidth(0.8)
        c.line(plot_x, plot_y, plot_x, plot_y + plot_h)
        c.line(plot_x, plot_y, plot_x + plot_w, plot_y)

        for i in range(5):
            yv = max_v * i / 4
            py = plot_y + i * plot_h / 4
            self._axis_label(c, self._compact_num(yv), plot_x - 3, py - 2, align="right")

        for i, yr in enumerate(self.years):
            gx = plot_x + i * group_w + group_w * 0.15
            s = self.solved[i] if i < len(self.solved) else 0
            bh = (s / max_v) * plot_h if max_v > 0 else 0
            self._bar(c, gx, plot_y, bar_w, bh, C_BLUE, self._compact_num(s))
            self._axis_label(c, yr, gx + bar_w / 2 + bar_w * 0.6, plot_y - 12)
            c.setFont("Helvetica-Bold", 6); c.setFillColor(C_TEXT_MAIN)
            c.drawCentredString(plot_x + i * group_w + group_w / 2, plot_y - 18, yr)

        # Legend
        c.setFillColor(C_BLUE); c.rect(self.width - 60, self.height - 12, 6, 5, fill=1, stroke=0)
        c.setFont("Helvetica", 5.5); c.setFillColor(C_TEXT_MAIN)
        c.drawString(self.width - 52, self.height - 11, "Total Solved")


# ─── Chart 8: Q1-Q4 Solve Rate ────────────────────────────────────────────────

class Q1Q4Chart(BaseChart):
    def __init__(self, q_labels: List[str], solve_rates: List[Optional[float]], **kwargs):
        super().__init__(**kwargs)
        self.q_labels = q_labels
        self.solve_rates = solve_rates

    def draw(self):
        c = self.canv
        self._draw_background(c)
        ty = self.height - 10
        ty = self._draw_title(c, ty)

        valid = [(q, v) for q, v in zip(self.q_labels, self.solve_rates) if v is not None]
        if not valid:
            self._draw_no_data(c)
            return

        pad_l, pad_r, pad_b = 34, 10, 24
        plot_w = self.width - pad_l - pad_r
        plot_h = ty - pad_b - 8
        plot_x, plot_y = pad_l, pad_b
        n = len(valid)
        bar_w = min(plot_w / n * 0.6, 32)
        gap = plot_w / n
        Q_COLORS = [C_EMERALD, C_AMBER, C_ORANGE, C_RED]

        for i in range(4):
            gy = plot_y + (i + 1) * plot_h / 4
            self._grid_line(c, plot_x, gy, plot_x + plot_w, gy)
        c.setStrokeColor(C_BORDER); c.setLineWidth(0.8)
        c.line(plot_x, plot_y, plot_x, plot_y + plot_h)
        c.line(plot_x, plot_y, plot_x + plot_w, plot_y)

        for i in range(5):
            yv = 100 * i / 4
            py = plot_y + i * plot_h / 4
            self._axis_label(c, f"{yv:.0f}%", plot_x - 3, py - 2, align="right")

        for i, (q, v) in enumerate(valid):
            bx = plot_x + i * gap + (gap - bar_w) / 2
            bh = (v / 100) * plot_h
            color = Q_COLORS[i % len(Q_COLORS)]
            self._bar(c, bx, plot_y, bar_w, bh, color, f"{v:.1f}%")
            self._axis_label(c, q, bx + bar_w / 2, plot_y - 12)


# ─── Chart 9: Difficulty Distribution ─────────────────────────────────────────

class DifficultyChart(BaseChart):
    def __init__(self, easy: int, medium: int, hard: int, **kwargs):
        super().__init__(**kwargs)
        self.easy = easy
        self.medium = medium
        self.hard = hard

    def draw(self):
        c = self.canv
        self._draw_background(c)
        ty = self.height - 10
        ty = self._draw_title(c, ty)

        total = (self.easy or 0) + (self.medium or 0) + (self.hard or 0)
        if total == 0:
            self._draw_no_data(c)
            return

        pad_l, pad_r, pad_b = 32, 12, 24
        plot_w = self.width - pad_l - pad_r
        plot_h = ty - pad_b - 8
        plot_x, plot_y = pad_l, pad_b
        cats = [("Easy", self.easy, C_EMERALD), ("Medium", self.medium, C_AMBER), ("Hard", self.hard, C_RED)]
        bar_w = plot_w / 3 * 0.65
        gap = plot_w / 3
        max_v = max(self.easy, self.medium, self.hard)

        for i in range(4):
            gy = plot_y + (i + 1) * plot_h / 4
            self._grid_line(c, plot_x, gy, plot_x + plot_w, gy)
        c.setStrokeColor(C_BORDER); c.setLineWidth(0.8)
        c.line(plot_x, plot_y, plot_x, plot_y + plot_h)
        c.line(plot_x, plot_y, plot_x + plot_w, plot_y)

        for i in range(5):
            yv = max_v * i / 4
            py = plot_y + i * plot_h / 4
            self._axis_label(c, self._compact_num(yv), plot_x - 3, py - 2, align="right")

        for i, (label, val, color) in enumerate(cats):
            bx = plot_x + i * gap + (gap - bar_w) / 2
            bh = (val / max_v) * plot_h if max_v > 0 else 0
            pct = val / total * 100
            self._bar(c, bx, plot_y, bar_w, bh, color, f"{pct:.0f}%")
            self._axis_label(c, label, bx + bar_w / 2, plot_y - 12)


# ─── Chart 10: Language Usage ──────────────────────────────────────────────────

class LanguageUsageChart(BaseChart):
    def __init__(self, langs: List[str], values: List[int], **kwargs):
        super().__init__(**kwargs)
        self.langs = langs
        self.values = values

    def draw(self):
        c = self.canv
        self._draw_background(c)
        ty = self.height - 10
        ty = self._draw_title(c, ty)

        if not self.langs or not any(v > 0 for v in self.values):
            self._draw_no_data(c)
            return

        pad_l, pad_r, pad_b, pad_t = 65, 50, 10, 5
        plot_w = self.width - pad_l - pad_r
        plot_h = ty - pad_b - pad_t
        plot_x, plot_y = pad_l, pad_b
        n = len(self.langs)
        bar_h = min(plot_h / n * 0.65, 12)
        gap = plot_h / n
        max_v = max(self.values) if self.values else 1

        for i, (lang, v) in enumerate(zip(self.langs, self.values)):
            by = plot_y + (n - 1 - i) * gap + (gap - bar_h) / 2
            bw = (v / max_v) * plot_w if max_v > 0 else 0
            color = LANG_COLORS[i % len(LANG_COLORS)]
            self._hbar(c, plot_x, by, bw, bar_h, color, self._compact_num(v))
            c.setFont("Helvetica", 6); c.setFillColor(C_TEXT_MAIN)
            c.drawRightString(plot_x - 4, by + bar_h / 2 - 2.5, lang[:14])


# ─── Chart 11: DSA Topic Distribution ─────────────────────────────────────────

class TopicDistChart(BaseChart):
    def __init__(self, topics: List[str], values: List[int], **kwargs):
        super().__init__(**kwargs)
        self.topics = topics[:10]
        self.values = values[:10]

    def draw(self):
        c = self.canv
        self._draw_background(c)
        ty = self.height - 10
        ty = self._draw_title(c, ty)

        if not self.topics or not any(v > 0 for v in self.values):
            self._draw_no_data(c)
            return

        pad_l, pad_r, pad_b, pad_t = 72, 48, 10, 5
        plot_w = self.width - pad_l - pad_r
        plot_h = ty - pad_b - pad_t
        plot_x, plot_y = pad_l, pad_b
        n = len(self.topics)
        bar_h = min(plot_h / n * 0.65, 11)
        gap = plot_h / n
        max_v = max(self.values) if self.values else 1

        for i, (topic, v) in enumerate(zip(self.topics, self.values)):
            by = plot_y + (n - 1 - i) * gap + (gap - bar_h) / 2
            bw = (v / max_v) * plot_w if max_v > 0 else 0
            self._hbar(c, plot_x, by, bw, bar_h, C_CYAN, self._compact_num(v))
            c.setFont("Helvetica", 5.5); c.setFillColor(C_TEXT_MAIN)
            c.drawRightString(plot_x - 4, by + bar_h / 2 - 2.5, topic[:16])


# ─── Chart 12: Rating Movement ────────────────────────────────────────────────

class RatingMovementChart(BaseChart):
    def __init__(self, gainers: int, stable: int, decliners: int, **kwargs):
        super().__init__(**kwargs)
        self.gainers = gainers
        self.stable = stable
        self.decliners = decliners

    def draw(self):
        c = self.canv
        self._draw_background(c)
        ty = self.height - 10
        ty = self._draw_title(c, ty)

        total = (self.gainers or 0) + (self.stable or 0) + (self.decliners or 0)
        if total == 0:
            self._draw_no_data(c)
            return

        pad_l, pad_r, pad_b = 30, 12, 24
        plot_w = self.width - pad_l - pad_r
        plot_h = ty - pad_b - 8
        plot_x, plot_y = pad_l, pad_b
        cats = [("Gainers", self.gainers, C_EMERALD), ("Stable", self.stable, C_BLUE), ("Decliners", self.decliners, C_RED)]
        bar_w = plot_w / 3 * 0.65
        gap = plot_w / 3
        max_v = max(self.gainers, self.stable, self.decliners)

        for i in range(4):
            gy = plot_y + (i + 1) * plot_h / 4
            self._grid_line(c, plot_x, gy, plot_x + plot_w, gy)
        c.setStrokeColor(C_BORDER); c.setLineWidth(0.8)
        c.line(plot_x, plot_y, plot_x, plot_y + plot_h)
        c.line(plot_x, plot_y, plot_x + plot_w, plot_y)

        for i in range(5):
            yv = max_v * i / 4
            py = plot_y + i * plot_h / 4
            self._axis_label(c, self._compact_num(yv), plot_x - 3, py - 2, align="right")

        for i, (label, val, color) in enumerate(cats):
            bx = plot_x + i * gap + (gap - bar_w) / 2
            bh = (val / max_v) * plot_h if max_v > 0 else 0
            pct = val / total * 100 if total > 0 else 0
            self._bar(c, bx, plot_y, bar_w, bh, color, f"{pct:.0f}%")
            self._axis_label(c, label, bx + bar_w / 2, plot_y - 12)


# ─── Chart 13: Risk Distribution ──────────────────────────────────────────────

class RiskDistributionChart(BaseChart):
    def __init__(self, risk_data: Dict[str, int], **kwargs):
        super().__init__(**kwargs)
        self.risk_data = risk_data

    def draw(self):
        c = self.canv
        self._draw_background(c)
        ty = self.height - 10
        ty = self._draw_title(c, ty)

        ordered = ["EXCELLENT", "IMPROVING", "STABLE", "WATCH", "AT_RISK", "INACTIVE", "DATA_REVIEW_REQUIRED"]
        cats = [(k, self.risk_data.get(k, 0)) for k in ordered if self.risk_data.get(k, 0) > 0]
        if not cats:
            self._draw_no_data(c)
            return

        pad_l, pad_r, pad_b = 32, 12, 32
        plot_w = self.width - pad_l - pad_r
        plot_h = ty - pad_b - 8
        plot_x, plot_y = pad_l, pad_b
        n = len(cats)
        bar_w = min(plot_w / n * 0.7, 30)
        gap = plot_w / n
        max_v = max(v for _, v in cats)
        total = sum(v for _, v in cats)

        for i in range(4):
            gy = plot_y + (i + 1) * plot_h / 4
            self._grid_line(c, plot_x, gy, plot_x + plot_w, gy)
        c.setStrokeColor(C_BORDER); c.setLineWidth(0.8)
        c.line(plot_x, plot_y, plot_x, plot_y + plot_h)
        c.line(plot_x, plot_y, plot_x + plot_w, plot_y)

        for i in range(5):
            yv = max_v * i / 4
            py = plot_y + i * plot_h / 4
            self._axis_label(c, self._compact_num(yv), plot_x - 3, py - 2, align="right")

        for i, (label, val) in enumerate(cats):
            bx = plot_x + i * gap + (gap - bar_w) / 2
            bh = (val / max_v) * plot_h if max_v > 0 else 0
            color = RISK_COLORS.get(label, C_SLATE)
            self._bar(c, bx, plot_y, bar_w, bh, color, self._compact_num(val))
            short = label.replace("_", " ")[:10]
            self._axis_label(c, short, bx + bar_w / 2, plot_y - 20, size=5)


# ─── Factory Functions ─────────────────────────────────────────────────────────

def make_chart(chart_cls, width, height, **kwargs) -> Optional[BaseChart]:
    """Safe chart factory — returns None if any required data is empty."""
    try:
        return chart_cls(width=width, height=height, **kwargs)
    except Exception:
        return None


def create_vertical_bar_chart(
    data: List[List[float]],
    categories: List[str],
    width: float = 700,
    height: float = 85,
    title: str = "",
    series_colors: Optional[List[Any]] = None,
    **kwargs
) -> Flowable:
    """Universal vertical bar chart factory flowable."""
    class GenericBarChart(Flowable):
        def __init__(self, data, categories, width, height, title, colors_list):
            super().__init__()
            self.data = data
            self.categories = categories
            self.width = width
            self.height = height
            self.title = title
            self.colors_list = colors_list or [C_BLUE]

        def wrap(self, availWidth, availHeight):
            return self.width, self.height

        def draw(self):
            canv = self.canv
            canv.setFillColor(C_LIGHT_BG)
            canv.setStrokeColor(C_BORDER)
            canv.setLineWidth(0.5)
            canv.roundRect(0, 0, self.width, self.height, 4, fill=1, stroke=1)

            if self.title:
                canv.setFont("Helvetica-Bold", 7.5)
                canv.setFillColor(C_TEXT_MAIN)
                canv.drawString(8, self.height - 10, self.title)

            vals = self.data[0] if self.data else []
            if not vals or not any(vals):
                canv.setFont("Helvetica-Oblique", 7.5)
                canv.setFillColor(C_TEXT_DIM)
                canv.drawCentredString(self.width / 2, self.height / 2 - 4, "DATA NOT AVAILABLE")
                return

            max_val = max(vals) or 1
            n = len(vals)
            chart_top = self.height - 18
            chart_bottom = 14
            chart_h = chart_top - chart_bottom
            chart_w = self.width - 24
            slot_w = chart_w / max(1, n)
            bar_w = min(24, slot_w * 0.6)

            for i, (cat, val) in enumerate(zip(self.categories, vals)):
                x = 12 + i * slot_w + (slot_w - bar_w) / 2
                h = max(2, (val / max_val) * chart_h) if val > 0 else 2
                color = self.colors_list[i % len(self.colors_list)] if isinstance(self.colors_list, list) else self.colors_list
                canv.setFillColor(color)
                canv.roundRect(x, chart_bottom, bar_w, h, 1.5, fill=1, stroke=0)
                
                canv.setFont("Helvetica-Bold", 6)
                canv.setFillColor(C_TEXT_MAIN)
                val_str = f"{val:,}" if isinstance(val, int) else f"{val:.0f}"
                canv.drawCentredString(x + bar_w / 2, chart_bottom + h + 2, val_str)
                
                canv.setFont("Helvetica", 5.5)
                canv.setFillColor(C_TEXT_DIM)
                canv.drawCentredString(x + bar_w / 2, 4, str(cat)[:10])

    return GenericBarChart(data, categories, width, height, title, series_colors)


def create_horizontal_distribution_bar(
    segments: Any,
    width: float = 700,
    height: float = 20,
    title: str = "",
    **kwargs
) -> Flowable:
    """Universal horizontal segmented distribution bar flowable. Handles both dicts and tuples."""
    class GenericHBar(Flowable):
        def __init__(self, segments, width, height, title):
            super().__init__()
            self.segments = segments or []
            self.width = width
            self.height = height
            self.title = title

        def wrap(self, availWidth, availHeight):
            return self.width, self.height

        def draw(self):
            canv = self.canv
            # Normalize segments to (label, val, color)
            norm_segments = []
            for s in self.segments:
                if isinstance(s, dict):
                    lbl = s.get("label", s.get("name", ""))
                    val = s.get("value", s.get("count", 0)) or 0
                    clr = s.get("color", C_BLUE)
                    norm_segments.append((lbl, float(val), clr))
                elif isinstance(s, (list, tuple)) and len(s) >= 3:
                    norm_segments.append((s[0], float(s[1] or 0), s[2]))
                elif isinstance(s, (list, tuple)) and len(s) == 2:
                    norm_segments.append((s[0], float(s[1] or 0), C_BLUE))

            total = sum(s[1] for s in norm_segments) or 1
            cur_x = 0
            for name, val, color in norm_segments:
                if val <= 0:
                    continue
                seg_w = (val / total) * self.width
                if seg_w > 0:
                    canv.setFillColor(color)
                    canv.rect(cur_x, 0, seg_w, self.height, fill=1, stroke=0)
                    if seg_w > 18:
                        canv.setFont("Helvetica-Bold", 6)
                        canv.setFillColor(white)
                        canv.drawCentredString(cur_x + seg_w / 2, self.height / 2 - 2, f"{val:.0f}")
                    cur_x += seg_w
    return GenericHBar(segments, width, height, title)


