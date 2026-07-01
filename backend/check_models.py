import sqlite3
import google.generativeai as genai

def get_key():
    conn = sqlite3.connect("fluidairmail.db")
    cursor = conn.cursor()
    cursor.execute("SELECT gemini_key FROM users WHERE gemini_key IS NOT NULL AND gemini_key != '' LIMIT 1")
    row = cursor.fetchone()
    conn.close()
    return row[0] if row else None

key = get_key()
if not key:
    print("No gemini key found in DB.")
else:
    genai.configure(api_key=key)
    try:
        models = genai.list_models()
        valid = []
        for m in models:
            if 'generateContent' in m.supported_generation_methods:
                valid.append(m.name)
        print("Available models:")
        print(valid)
    except Exception as e:
        print(f"Error listing models: {e}")
