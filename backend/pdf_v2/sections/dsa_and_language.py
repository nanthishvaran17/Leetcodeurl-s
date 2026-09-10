from reportlab.platypus import Paragraph, Spacer, Table

def build_dsa_intelligence(dataset, styles, table_style):
    """SECTION 5: DSA Topic Intelligence"""
    story = []
    topics = dataset["topics"]
    
    story.append(Paragraph("4. DSA Topic Intelligence", styles['SectionHeader']))
    
    # Sort topics by total solved descending
    sorted_topics = sorted(topics.items(), key=lambda x: x[1]["w0"], reverse=True)
    
    data = [["DSA Topic", "Total Problems Solved"]]
    for topic_name, metrics in sorted_topics:
        if metrics["w0"] > 0:
            data.append([topic_name.title().replace("-", " "), str(metrics["w0"])])
        
    if len(data) > 1:
        t = Table(data, colWidths=[200, 150])
        t.setStyle(table_style)
        story.append(t)
    else:
        story.append(Paragraph("No topic data available.", styles['NormalText']))
        
    story.append(Spacer(1, 20))
    return story

def build_language_intelligence(dataset, styles, table_style):
    """SECTION 6: Programming Language Intelligence"""
    story = []
    langs = dataset["languages"]
    
    story.append(Paragraph("5. Programming Language Intelligence", styles['SectionHeader']))
    
    sorted_langs = sorted(langs.items(), key=lambda x: x[1]["w0"], reverse=True)
    
    data = [["Language", "Total Problems Solved"]]
    for lang_name, metrics in sorted_langs:
        if metrics["w0"] > 0:
            data.append([lang_name, str(metrics["w0"])])
        
    if len(data) > 1:
        t = Table(data, colWidths=[200, 150])
        t.setStyle(table_style)
        story.append(t)
    else:
        story.append(Paragraph("No language data available.", styles['NormalText']))
        
    story.append(Spacer(1, 20))
    return story
