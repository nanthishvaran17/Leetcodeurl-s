from reportlab.platypus import Paragraph, Spacer, Table, PageBreak

def build_department_intelligence(dataset, styles, table_style):
    """SECTION 3: Department Intelligence"""
    story = []
    depts = dataset["departments"]
    
    story.append(Paragraph("2. Department Intelligence (3-Week View)", styles['SectionHeader']))
    
    data = [["Department", "W-2 Solved", "W-1 Solved", "Current Solved", "Delta (Current - W-1)"]]
    for dept, metrics in depts.items():
        delta = metrics["w0"] - metrics["w1"]
        data.append([
            dept,
            str(metrics["w2"]),
            str(metrics["w1"]),
            str(metrics["w0"]),
            f"+{delta}" if delta > 0 else str(delta)
        ])
        
    if len(data) > 1:
        t = Table(data, colWidths=[150, 80, 80, 80, 100])
        t.setStyle(table_style)
        story.append(t)
    else:
        story.append(Paragraph("No department data available in snapshot.", styles['NormalText']))
        
    story.append(Spacer(1, 20))
    return story

def build_year_intelligence(dataset, styles, table_style):
    """SECTION 4: Year-wise Intelligence"""
    story = []
    years = dataset["years"]
    
    story.append(Paragraph("3. Year-wise Intelligence", styles['SectionHeader']))
    
    data = [["Year / Batch", "W-2 Solved", "W-1 Solved", "Current Solved", "Delta"]]
    for yr, metrics in sorted(years.items()):
        delta = metrics["w0"] - metrics["w1"]
        data.append([
            yr,
            str(metrics["w2"]),
            str(metrics["w1"]),
            str(metrics["w0"]),
            f"+{delta}" if delta > 0 else str(delta)
        ])
        
    if len(data) > 1:
        t = Table(data, colWidths=[150, 80, 80, 80, 100])
        t.setStyle(table_style)
        story.append(t)
    else:
        story.append(Paragraph("No year-wise data available in snapshot.", styles['NormalText']))
        
    story.append(Spacer(1, 20))
    return story
