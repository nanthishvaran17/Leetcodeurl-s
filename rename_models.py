with open('e:/Leetcode Web/backend/models.py', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('q1_time', 'q1_observed_active_seconds')
text = text.replace('q2_time', 'q2_observed_active_seconds')
text = text.replace('q3_time', 'q3_observed_active_seconds')
text = text.replace('q4_time', 'q4_observed_active_seconds')

with open('e:/Leetcode Web/backend/models.py', 'w', encoding='utf-8') as f:
    f.write(text)
