"""SQLAlchemy database connection and base configuration.

This module provides:
- Async SQLAlchemy engine configured for PostgreSQL with asyncpg
- Base class for all ORM models
- Session factory for database operations
- Dependency injection helper for FastAPI routes
"""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from config import get_settings


# Get settings
settings = get_settings()

# Create async engine for PostgreSQL
# Pool settings optimized for web application workload
engine = create_async_engine(
    settings.async_database_url,
    echo=settings.debug,  # Log SQL in debug mode
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,  # Verify connections before use
)

# Session factory for creating async sessions
async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,  # Don't expire objects after commit for easier use
)


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy ORM models.

    All models should inherit from this class to be included
    in database migrations and to share common functionality.
    """
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency injection helper for FastAPI routes.

    Usage in FastAPI endpoints:
        @app.get("/items")
        async def get_items(db: AsyncSession = Depends(get_db)):
            result = await db.execute(select(Item))
            return result.scalars().all()

    Yields:
        AsyncSession: Database session that auto-commits on success
        and rolls back on exception.
    """
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def init_db() -> None:
    """Initialize database tables.

    Creates all tables defined by models inheriting from Base.
    Should be called during application startup.

    Note: In production, prefer using Alembic migrations instead
    of this function to manage schema changes.
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def close_db() -> None:
    """Close database connections.

    Should be called during application shutdown to properly
    close all database connections in the pool.
    """
    await engine.dispose()
