"""Database models package.

This package contains SQLAlchemy models for the Finnish Statistics platform:
- database.py: Database connection and Base class
- dimensions.py: Region and Industry dimension tables
- statistics.py: Dataset and Statistic tables (to be created)
- fetch_config.py: FetchConfig table for scheduling (to be created)
"""

from models.database import Base, engine, async_session_maker, get_db
from models.dimensions import Region, Industry

__all__ = [
    "Base",
    "engine",
    "async_session_maker",
    "get_db",
    "Region",
    "Industry",
]
