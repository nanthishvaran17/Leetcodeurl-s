import re
with open('e:/Leetcode Web/backend/models.py', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace all occurrences of q1_observed_active_seconds -> q1_observed_seconds
text = text.replace('q1_observed_active_seconds', 'q1_observed_seconds')
text = text.replace('q2_observed_active_seconds', 'q2_observed_seconds')
text = text.replace('q3_observed_active_seconds', 'q3_observed_seconds')
text = text.replace('q4_observed_active_seconds', 'q4_observed_seconds')

# Now add estimated_seconds, time_source, and provenance columns to each model
new_q_cols = '''
    q1_estimated_seconds = Column(Integer, nullable=True)
    q2_estimated_seconds = Column(Integer, nullable=True)
    q3_estimated_seconds = Column(Integer, nullable=True)
    q4_estimated_seconds = Column(Integer, nullable=True)
    q1_time_source = Column(String(50), nullable=True)
    q2_time_source = Column(String(50), nullable=True)
    q3_time_source = Column(String(50), nullable=True)
    q4_time_source = Column(String(50), nullable=True)
    timing_calculation_version = Column(String(20), nullable=True)
    timing_calculated_at = Column(DateTime, nullable=True)
    timing_confidence = Column(String(20), nullable=True)'''

# Find and replace pattern for all three tables
anchor = '    q4_observed_seconds = Column(Integer, nullable=True)'
if anchor in text:
    # Replace only first occurrence that doesn't already have estimated cols after
    count = text.count(anchor)
    print(f'Found {count} anchors')
    text = text.replace(anchor, anchor + new_q_cols, count)

with open('e:/Leetcode Web/backend/models.py', 'w', encoding='utf-8') as f:
    f.write(text)
print('models.py updated')
