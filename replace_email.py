import re

with open('e:/Leetcode Web/backend/services/email_notifications.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace label style
old_label = 'label_style = "padding:10px 12px; border-bottom:1px solid #e2e8f0; color:#64748b; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; width:170px; min-width:170px; max-width:170px; background-color:#f8fafc; vertical-align:top;"'
new_label = 'label_style = "padding:10px 12px; border-bottom:1px solid #e2e8f0; color:#64748b; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; width:35%; background-color:#f8fafc; vertical-align:top;"'
content = content.replace(old_label, new_label)

# Replace table td tags with class stack-label and stack-value
content = content.replace("<td style='{label_style}'>", "<td class='stack-label' style='{label_style}'>")
content = content.replace("<td style='{value_style}'>", "<td class='stack-value safe-wrap' style='{value_style}'>")

# Audit table
old_audit_label = 'audit_label_style = "padding:6px 12px; color:#64748b; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; width:140px; min-width:140px; max-width:140px; vertical-align:top;"'
new_audit_label = 'audit_label_style = "padding:6px 12px; color:#64748b; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; width:35%; vertical-align:top;"'
content = content.replace(old_audit_label, new_audit_label)

content = content.replace("<td style='{audit_label_style}'>", "<td class='stack-label' style='{audit_label_style}'>")
content = content.replace("<td style='{audit_value_style}'", "<td class='stack-value safe-wrap' style='{audit_value_style}'")

# Add data-table class to tables
content = content.replace('style="width:100%; border-collapse:separate; border-spacing:0; border:1px solid #e2e8f0; border-radius:6px; margin:16px 0; overflow:hidden;"', 'class="data-table" style="width:100%; border-collapse:separate; border-spacing:0; border:1px solid #e2e8f0; border-radius:6px; margin:16px 0; overflow:hidden; table-layout:fixed;"')
content = content.replace('style="width:100%; font-size:12px; font-family:monospace; border-collapse:collapse;"', 'class="data-table" style="width:100%; font-size:12px; font-family:monospace; border-collapse:collapse; table-layout:fixed;"')

# Button fluid class
old_button = 'action_button = f\'<a href="{portal_url}" style="display:inline-block; background-color:#2563eb; color:#ffffff; padding:14px 28px; text-decoration:none; border-radius:6px; font-weight:bold; font-size:15px; text-align:center; min-width:200px;">View Staff Account</a>\''
new_button = 'action_button = f\'<a href="{portal_url}" class="btn" style="display:inline-block; background-color:#2563eb; color:#ffffff; padding:14px 28px; text-decoration:none; border-radius:6px; font-weight:bold; font-size:15px; text-align:center; min-width:200px; box-sizing:border-box;">View Staff Account</a>\''
content = content.replace(old_button, new_button)

# Security Notice fluid class
content = content.replace('<div class="security-notice" style="margin-top:32px; background:#fff1f2; border:1px solid #fecdd3; padding:16px; border-radius:6px;">', '<div class="security-notice" style="margin-top:32px; background:#fff1f2; border:1px solid #fecdd3; padding:16px; border-radius:6px; box-sizing:border-box; width:100%; max-width:100%;">')

with open('e:/Leetcode Web/backend/services/email_notifications.py', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done modifying email_notifications.py')
