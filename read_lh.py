import urllib.request
import json
import re

html = urllib.request.urlopen("https://storage.googleapis.com/lighthouse-infrastructure.appspot.com/reports/1789745615913-17604.report.html").read().decode("utf-8")
match = re.search(r"window\.__LIGHTHOUSE_JSON__ = (.*?);</script>", html)
data = json.loads(match.group(1))
print(f"Performance: {data['categories']['performance']['score'] * 100}")
print(f"LCP: {data['audits']['largest-contentful-paint']['displayValue']}")
print(f"FCP: {data['audits']['first-contentful-paint']['displayValue']}")
print(f"Speed Index: {data['audits']['speed-index']['displayValue']}")
print(f"TBT: {data['audits']['total-blocking-time']['displayValue']}")
print(f"CLS: {data['audits']['cumulative-layout-shift']['displayValue']}")
print("LCP Element:")
print(json.dumps(data['audits']['largest-contentful-paint-element']['details']['items'][0].get('node', {}), indent=2))
