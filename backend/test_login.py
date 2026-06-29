import requests

print("Testing login endpoint...")
try:
    res = requests.post("http://localhost:8000/login", json={"email": "test@example.com", "password": "password"})
    print("Status:", res.status_code)
    print("Response:", res.text)
except Exception as e:
    print("Exception:", e)
