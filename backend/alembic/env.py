"""Alembic migration environment configuration.

This module configures Alembic to work with our async SQLAlchemy setup.
It supports both online (connected to database) and offline (SQL generation only)
migration modes.

The configuration:
- Loads database URL from our Pydantic Settings
- Uses async SQLAlchemy engine for online migrations
- Imports all models to ensure metadata is complete
- Supports running migrations programmatically
"""

import asyncio
import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Import our application config and models
from config import get_settings
from models import Base  # This imports all models via __init__.py


# Alembic Config object providing access to the .ini file values
config = context.config

# Get application settings
settings = get_settings()

# Override sqlalchemy.url with our application's database URL
# We use the async URL since we're running migrations with asyncpg
config.set_main_option("sqlalchemy.url", settings.async_database_url)

# Configure Python logging from alembic.ini
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Target metadata for autogenerate support
# This is the MetaData object containing all our model definitions
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This generates SQL migration scripts without connecting to the database.
    Useful for generating SQL to be reviewed before executing.

    Configures the context with just a URL and not an Engine.
    Calls to context.execute() emit the given SQL to the script output.
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,  # Detect column type changes
        compare_server_default=True,  # Detect default value changes
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    """Execute migrations using an existing database connection.

    This is called from both the sync and async migration runners.

    Args:
        connection: Active database connection to use for migrations
    """
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,  # Detect column type changes
        compare_server_default=True,  # Detect default value changes
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Run migrations in 'online' mode using async engine.

    Creates an async Engine and associates a connection with the context.
    This is the preferred method for our async SQLAlchemy setup.
    """
    # Create configuration dict with async driver
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = settings.async_database_url

    connectable = async_engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,  # Don't use connection pooling for migrations
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    This is the entry point for online migrations, which creates a connection
    to the database and runs migrations using asyncio.
    """
    asyncio.run(run_async_migrations())


# Determine which mode to run in
if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
