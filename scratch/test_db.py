import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select
import os
import sys

sys.path.append(os.path.join(os.getcwd(), 'backend'))
import models
import security

DATABASE_URL = "sqlite+aiosqlite:///./backend/mailnet.db"

async def test():
    engine = create_async_engine(DATABASE_URL, echo=False)
    session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with session_maker() as db:
        res = await db.execute(select(models.User).where(models.User.email == 'testuser@mailnet.com'))
        user = res.scalars().first()
        if user:
            user.hashed_password = security.get_password_hash("password123")
            await db.commit()
            print("Successfully updated password of testuser@mailnet.com to password123")
        else:
            print("User testuser@mailnet.com not found")
    await engine.dispose()

if __name__ == '__main__':
    asyncio.run(test())
