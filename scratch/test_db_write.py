import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select
import os
import sys

sys.path.append(os.path.join(os.getcwd(), 'backend'))
import models

DATABASE_URL = "sqlite+aiosqlite:///./backend/mailnet.db"

async def test():
    engine = create_async_engine(DATABASE_URL, echo=False)
    session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with session_maker() as db:
        # Let's create a dummy message with metadata
        metadata = {"attachment_url": "http://localhost:8000/uploads/test.png"}
        msg = models.Message(
            thread_id=1,
            sender_id=1,
            encrypted_content="test attachment message",
            status="sent",
            metadata_json=metadata
        )
        db.add(msg)
        await db.commit()
        await db.refresh(msg)
        print(f"Saved msg ID: {msg.id}")
        print(f"Saved metadata_json type: {type(msg.metadata_json)}, val: {msg.metadata_json}")
        
        # Read it back in a new session
        await db.close()
        
    async with session_maker() as db2:
        res = await db2.execute(select(models.Message).where(models.Message.id == msg.id))
        msg_loaded = res.scalars().first()
        print(f"Loaded msg ID: {msg_loaded.id}")
        print(f"Loaded metadata_json type: {type(msg_loaded.metadata_json)}, val: {msg_loaded.metadata_json}")
        # Clean up
        await db2.delete(msg_loaded)
        await db2.commit()
        
    await engine.dispose()

if __name__ == '__main__':
    asyncio.run(test())
