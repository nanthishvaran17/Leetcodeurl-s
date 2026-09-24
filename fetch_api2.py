import urllib.request
import json
import sys

try:
    req = urllib.request.Request('http://127.0.0.1:8000/contests/sessions/18/matrix')
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
        
        # Write to file for inspection
        with open('output.json', 'w') as f:
            json.dump(data[:5], f, indent=2)
            
        print('Wrote output.json')
except Exception as e:
    print(e)
