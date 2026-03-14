"""SQLAlchemy database connection and base configuration.

This module provides:
- Async SQLAlchemy engine configured for PostgreSQL with asyncpg
- Base class for all ORM models
- Session factory for database operations
- Dependency injection helper for FastAPI routes
- Database query logging with performance tracking (when DEBUG=true)
"""

import logging
import os
import time
from collections.abc import AsyncGenerator

from sqlalchemy import Engine, event
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from config import get_settings
from logging_config import request_id_var


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


# Database query logging (only active when DEBUG=true)
DEBUG = os.getenv("DEBUG", "false").lower() == "true"
SLOW_QUERY_THRESHOLD_MS = 100  # Flag queries slower than 100ms
logger = logging.getLogger(__name__)


@event.listens_for(Engine, "before_cursor_execute")
def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    """Capture query start time for performance tracking.

    Args:
        conn: Database connection
        cursor: Database cursor
        statement: SQL statement to execute
        parameters: Query parameters
        context: Execution context
        executemany: Whether executing multiple statements
    """
    if DEBUG:
        # Store start time in connection info for duration calculation
        conn.info.setdefault("query_start_time", []).append(time.perf_counter())


@event.listens_for(Engine, "after_cursor_execute")
def after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    """Log query execution with duration and slow query detection.

    Args:
        conn: Database connection
        cursor: Database cursor
        statement: SQL statement executed
        parameters: Query parameters
        context: Execution context
        executemany: Whether executed multiple statements
    """
    if DEBUG:
        # Calculate query duration
        start_times = conn.info.get("query_start_time", [])
        if start_times:
            start_time = start_times.pop()
            duration_ms = (time.perf_counter() - start_time) * 1000

            # Determine if query is slow
            is_slow = duration_ms > SLOW_QUERY_THRESHOLD_MS

            # Log query execution with structured data
            log_data = {
                "sql": statement,
                "params": parameters,
                "duration_ms": round(duration_ms, 2),
                "slow_query": is_slow,
                "request_id": request_id_var.get(""),
            }

            if is_slow:
                logger.warning(
                    f"Slow database query ({duration_ms:.2f}ms)",
                    extra=log_data,
                )
            else:
                logger.debug(
                    f"Database query executed ({duration_ms:.2f}ms)",
                    extra=log_data,
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
