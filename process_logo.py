import urllib.request
import io
from PIL import Image

# Open the downloaded image
img = Image.open("downloaded_logo.png").convert("RGBA")
datas = img.getdata()

# Assume top-left pixel is the background color
bg_color = datas[0]
bg_r, bg_g, bg_b, _ = bg_color

newData = []
tolerance = 30 # For JPG compression artifacts or slight variations

for item in datas:
    r, g, b, a = item
    if (abs(r - bg_r) < tolerance and 
        abs(g - bg_g) < tolerance and 
        abs(b - bg_b) < tolerance):
        # Change to transparent
        newData.append((255, 255, 255, 0))
    else:
        newData.append(item)

img.putdata(newData)

# Save to memory buffer
buffer = io.BytesIO()
img.save(buffer, format="PNG")
img.save("transparent_logo.png")

# Upload to catbox.moe
import requests
files = {'reqtype': (None, 'fileupload'), 'fileToUpload': ('transparent_logo.png', buffer.getvalue(), 'image/png')}
response = requests.post('https://catbox.moe/user/api.php', files=files)
print(response.text)
