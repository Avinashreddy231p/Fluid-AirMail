import asyncio
from database import engine, Base
import models
import sqlite3

async def run_async_migrations():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

def run_sync_migrations():
    conn = sqlite3.connect('fluidairmail.db')
    cursor = conn.cursor()
    try:
        cursor.execute("ALTER TABLE users ADD COLUMN default_tone VARCHAR DEFAULT 'professional'")
        conn.commit()
        print("Sync migration successful")
    except Exception as e:
        print(f"Sync migration error: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    run_sync_migrations()
    asyncio.run(run_async_migrations())
    print("All migrations complete.")
