import base64
with open(r'C:\Users\Nanth\.gemini\antigravity-ide\brain\b91ffebb-e874-4df4-a08d-4f2a4fa5b4cd\.user_uploaded\media_1788199600296.jpg', 'rb') as f:
    content = base64.b64encode(f.read()).decode('utf-8')
with open('backend/services/email_assets.py', 'w') as f:
    f.write(f'NEC_25_LOGO_BASE64 = "{content}"\n')
