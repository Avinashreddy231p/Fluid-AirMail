import sqlite3

def run():
    conn = sqlite3.connect("mailnet.db")
    cursor = conn.cursor()
    try:
        cursor.execute("ALTER TABLE users ADD COLUMN ai_model VARCHAR")
        print("Column ai_model added to users table.")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e):
            print("Column ai_model already exists.")
        else:
            print(f"Error: {e}")
    conn.commit()
    conn.close()

if __name__ == "__main__":
    run()
