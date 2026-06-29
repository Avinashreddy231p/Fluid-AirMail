import requests

print("Testing health endpoint...")
try:
    res = requests.get("http://localhost:8000/health", timeout=5)
    print("Status:", res.status_code)
    print("Response:", res.text)
except Exception as e:
    print("Exception:", e)
