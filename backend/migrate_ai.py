import sqlite3

def run():
    conn = sqlite3.connect('mailnet.db')
    cursor = conn.cursor()
    try:
        cursor.execute("ALTER TABLE users ADD COLUMN ai_provider VARCHAR DEFAULT 'ollama'")
        cursor.execute("ALTER TABLE users ADD COLUMN openai_key VARCHAR")
        cursor.execute("ALTER TABLE users ADD COLUMN ollama_url VARCHAR DEFAULT 'http://localhost:11434/v1'")
        conn.commit()
        print("Migration successful")
    except Exception as e:
        print(f"Migration error: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    run()
