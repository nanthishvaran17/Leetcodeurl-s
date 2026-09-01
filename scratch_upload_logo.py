import urllib.request
import base64
import json

from backend.services.email_assets import NEC_25_LOGO_BASE64

img_data = base64.b64decode(NEC_25_LOGO_BASE64)

# Upload to catbox.moe
boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'
body = (
    b'--' + boundary.encode() + b'\r\n'
    b'Content-Disposition: form-data; name="reqtype"\r\n\r\n'
    b'fileupload\r\n'
    b'--' + boundary.encode() + b'\r\n'
    b'Content-Disposition: form-data; name="fileToUpload"; filename="logo.jpg"\r\n'
    b'Content-Type: image/jpeg\r\n\r\n'
    + img_data + b'\r\n'
    b'--' + boundary.encode() + b'--\r\n'
)

req = urllib.request.Request(
    'https://catbox.moe/user/api.php',
    data=body,
    headers={'Content-Type': f'multipart/form-data; boundary={boundary}'},
    method='POST'
)
try:
    with urllib.request.urlopen(req) as response:
        print('Uploaded URL:', response.read().decode())
except Exception as e:
    print('Failed:', e)
