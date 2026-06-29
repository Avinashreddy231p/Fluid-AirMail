import sqlite3

def run():
    conn = sqlite3.connect('mailnet.db')
    cursor = conn.cursor()
    try:
        cursor.execute("ALTER TABLE users ADD COLUMN security_question VARCHAR")
        cursor.execute("ALTER TABLE users ADD COLUMN security_answer VARCHAR")
        conn.commit()
        print("Migration successful")
    except Exception as e:
        print(f"Migration error: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    run()
