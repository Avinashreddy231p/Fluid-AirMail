from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base

import os

# Use SQLite for local development mock, but in production we'd use asyncpg + postgres
# To truly support JSONB, we'll use a JSON type that maps to JSONB in Postgres but works as JSON in SQLite.
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./mailnet.db")

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

Base = declarative_base()

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
