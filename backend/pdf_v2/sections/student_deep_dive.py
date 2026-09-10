from reportlab.platypus import Paragraph, Spacer, Table

def build_student_comparison(dataset, styles, table_style):
    """SECTION 8: Student-level 3-Week Comparison"""
    story = []
    students = dataset["students"]
    
    story.append(Paragraph("6. Student-Level 3-Week Comparison", styles['SectionHeader']))
    
    # Sort by Current Solved (W0) descending
    sorted_students = sorted(students, key=lambda x: x["w0_solved"], reverse=True)
    
    data = [["Reg No", "Student Name", "Dept", "Year", "W-2", "W-1", "Current", "Delta"]]
    for s in sorted_students[:50]: # Limit to top 50 to prevent massive memory usage, or paginate
        delta = s["delta_w0_w1"]
        data.append([
            s["reg_no"],
            s["name"][:15] + ".." if len(s["name"]) > 17 else s["name"],
            s["dept"],
            s["year"],
            str(s["w2_solved"]),
            str(s["w1_solved"]),
            str(s["w0_solved"]),
            f"+{delta}" if delta > 0 else str(delta)
        ])
        
    if len(data) > 1:
        t = Table(data, colWidths=[70, 110, 50, 50, 40, 40, 45, 45], repeatRows=1)
        t.setStyle(table_style)
        story.append(t)
    else:
        story.append(Paragraph("No student data available.", styles['NormalText']))
        
    story.append(Spacer(1, 20))
    return story
